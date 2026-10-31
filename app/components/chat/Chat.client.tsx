import { useChat } from '@ai-sdk/react';
import { useStore } from '@nanostores/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from 'ai';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { BaseChat } from './BaseChat';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { getLlmRequestHeaders, readStoredApiKeys } from '~/lib/api/api-key-storage';
import { API_KEYS_UPDATED_EVENT, type ApiKeysUpdatedDetail } from '~/lib/api/apiKeys';
import { readPref, removePref, writePref } from '~/lib/api/prefs-storage';
import { isServerAgentTool } from '~/lib/common/agentLoop';
import { STARTER_BUILD_FLAG } from '~/lib/common/starterBuild';
import { classifyUserError } from '~/lib/errors/user-facing';
import { useCostGuard, useLoopBreaker, useMessageParser, usePromptEnhancer, useShortcuts } from '~/lib/hooks';
import { useSettings } from '~/lib/hooks/useSettings';
import { description, useChatHistory } from '~/lib/persistence';
import {
  createMessage,
  getMessageParts,
  getMessageText,
  getToolCallId,
  getToolInput,
  getToolName,
  isToolCallPart,
  type AnyPart,
} from '~/lib/persistence/messageMigration';
import { chatId } from '~/lib/persistence/useChatHistory';
import { isFirstBuildRequest, isWorkspaceEmpty, shouldPlanThisTurn } from '~/lib/plan';
import { executeTextUtility, getPluginToolName, isSupportedAdapter } from '~/lib/plugins/adapters';
import { pluginDatabase } from '~/lib/plugins/database';
import type { PluginManifest } from '~/lib/plugins/schema';
import { pluginManifestSchema } from '~/lib/plugins/schema';
import { callProjectMcpTool, PROJECT_TOOL_NAMES } from '~/lib/runtime/projectMcp';
import { chatStore } from '~/lib/stores/chat';
import {
  emptyHomeChatRuntime,
  homeChatRuntime,
  homeComposerDraft,
  homeComposerSendNonce,
} from '~/lib/stores/home-composer';
import { logStore } from '~/lib/stores/logs';
import { useMCPStore } from '~/lib/stores/mcp';
import { consumePlanTurnFlags, ingestPlanReply, planSettingsStore, rememberPlanningPrompt } from '~/lib/stores/plan';
import { usePluginStore } from '~/lib/stores/plugins';
import { streamingState } from '~/lib/stores/streaming';
import { supabaseConnection } from '~/lib/stores/supabase';
import { workbenchStore } from '~/lib/stores/workbench';
import { bootWebContainer } from '~/lib/webcontainer';
import type { LlmErrorAlertType } from '~/types/actions';
import type { ProgressAnnotation } from '~/types/context';
import { defaultDesignScheme, type DesignScheme } from '~/types/design-scheme';
import type { ProviderInfo } from '~/types/model';
import { shouldPreserveChatMessagesOnRefresh } from '~/utils/chatHistoryRefresh';
import { DEFAULT_MODEL, TOOL_EXECUTION_APPROVAL } from '~/utils/constants-core';
import { debounce } from '~/utils/debounce';
import { cubicEasingFn } from '~/utils/easings';
import { filesToArtifacts } from '~/utils/fileUtils';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { resolveProjectCallContext } from '~/utils/projectCallContext';
import { createCommandsMessage, detectProjectCommands } from '~/utils/projectCommands';
import { DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/provider-list';
import { createSampler } from '~/utils/sampler';
import { getTemplates, selectStarterTemplate } from '~/utils/selectStarterTemplate';

const logger = createScopedLogger('Chat');

export function Chat({ suppressHome = false }: { suppressHome?: boolean } = {}) {
  renderLogger.trace('Chat');

  const { ready, initialMessages, chatChanged, storeMessageHistory, importChat, exportChat } = useChatHistory();
  const title = useStore(description);
  useEffect(() => {
    workbenchStore.setReloadedMessages(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  if (!ready) {
    return suppressHome ? null : <BaseChat />;
  }

  return (
    <ChatImpl
      suppressHome={suppressHome}
      description={title}
      initialMessages={initialMessages}
      chatChanged={chatChanged}
      exportChat={exportChat}
      storeMessageHistory={storeMessageHistory}
      importChat={importChat}
    />
  );
}

const processSampledMessages = createSampler(
  (options: {
    messages: UIMessage[];
    initialMessages: UIMessage[];
    isLoading: boolean;
    isPreparingProject: boolean;
    parseMessages: (messages: UIMessage[], isLoading: boolean) => void;
    storeMessageHistory: (messages: UIMessage[], isStreaming?: boolean) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, isPreparingProject, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages, isLoading || isPreparingProject).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: UIMessage[];

  /** True when `initialMessages` belong to a different chat than the ones they replace. */
  chatChanged: boolean;

  storeMessageHistory: (messages: UIMessage[], isStreaming?: boolean) => Promise<void>;
  importChat: (description: string, messages: UIMessage[]) => Promise<void>;
  exportChat: () => void;
  description?: string;

  /**
   * Keep the SSR home shell painted. ChatImpl still runs (send, model, keys)
   * but does not mount a second hero until a build starts.
   */
  suppressHome?: boolean;
}

export const ChatImpl = memo(
  ({
    description,
    initialMessages,
    chatChanged,
    storeMessageHistory,
    importChat,
    exportChat,
    suppressHome = false,
  }: ChatProps) => {
    useShortcuts();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const hasAppliedInitialMessagesRef = useRef(false);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [fakeLoading, setFakeLoading] = useState(false);
    const files = useStore(workbenchStore.files);
    const [designScheme, setDesignScheme] = useState<DesignScheme>(defaultDesignScheme);
    const actionAlert = useStore(workbenchStore.alert);
    const deployAlert = useStore(workbenchStore.deployAlert);
    const currentChatId = useStore(chatId);
    const supabaseConn = useStore(supabaseConnection);

    const selectedProject = supabaseConn.stats?.projects?.find(
      (project) => project.id === supabaseConn.selectedProjectId,
    );

    // const _supabaseAlert = undefined;
    const { activeProviders, promptId, autoSelectTemplate, contextOptimizationEnabled } = useSettings();
    const [llmErrorAlert, setLlmErrorAlert] = useState<LlmErrorAlertType | undefined>(undefined);

    const [model, setModel] = useState(() => {
      const savedModel = readPref('selectedModel');
      return savedModel || DEFAULT_MODEL;
    });
    const [provider, setProvider] = useState(() => {
      const savedProvider = readPref('selectedProvider');
      return (PROVIDER_LIST.find((p) => p.name === savedProvider) || DEFAULT_PROVIDER) as ProviderInfo;
    });

    const { showChat } = useStore(chatStore);
    const [animationScope, animate] = useAnimate();
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');
    const [agentMode, setAgentMode] = useState(() => readPref('agentMode') === 'true');
    const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
    const mcpSettings = useMCPStore((state) => state.settings);
    const installedPlugins = usePluginStore((state) => state.plugins);
    const initializePlugins = usePluginStore((state) => state.initialize);

    useEffect(() => {
      void initializePlugins();
    }, [initializePlugins]);

    /*
     * v5 removed the managed input state: `input`, `setInput` and
     * `handleInputChange` are gone, so it is local state here. `initialInput` is
     * gone too, hence the useState initializer.
     */
    const [input, setInput] = useState(homeComposerDraft.get() || readPref('cachedPrompt') || '');

    useEffect(() => {
      return homeComposerDraft.subscribe((value) => {
        setInput(value);
      });
    }, []);

    /*
     * v5 removed the data array from useChat in favour of an onData
     * callback, so progress annotations are local state again.
     */
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const pendingTemplateContinuationRef = useRef<UIMessage | null>(null);
    const parsedStarterSetupMessagesRef = useRef(new Set<string>());

    const pendingTemplateParserRef = useRef<(messages: { id: string; role?: string }[], isLoading: boolean) => void>(
      () => undefined,
    );

    const costUsageRef = useRef<(data: unknown) => void>(() => undefined);
    const costBypassRef = useRef(false);
    const planModeRef = useRef(false);

    const bodyRef = useRef({
      files,
      promptId,
      contextOptimization: contextOptimizationEnabled,
      chatMode,
      agentMode,
      designScheme,
      supabase: {
        isConnected: mcpSettings.connectorEnabled.supabase && supabaseConn.isConnected,
        hasSelectedProject: mcpSettings.connectorEnabled.supabase && !!selectedProject,
        credentials: {
          supabaseUrl: mcpSettings.connectorEnabled.supabase ? supabaseConn?.credentials?.supabaseUrl : undefined,
          anonKey: mcpSettings.connectorEnabled.supabase ? supabaseConn?.credentials?.anonKey : undefined,
        },
      },
      maxLLMSteps: mcpSettings.maxLLMSteps,
      planMode: false,
      webSearchEnabled: mcpSettings.webSearchEnabled,
      connectorEnabled: mcpSettings.connectorEnabled,
      toolEnabled: mcpSettings.toolEnabled,
      plugins: installedPlugins
        .filter((plugin) => plugin.enabled)
        .map((plugin) => {
          const manifest = plugin.manifest as PluginManifest;
          const tools = manifest.tools.filter((tool) => plugin.configuration[`toolDisabled:${tool}`] !== true);

          return { id: plugin.id, adapter: manifest.contribution.adapter, tools };
        })
        .filter((plugin) => plugin.tools.length > 0),
    });

    bodyRef.current = {
      files,
      promptId,
      contextOptimization: contextOptimizationEnabled,
      chatMode,
      agentMode,
      designScheme,
      supabase: {
        isConnected: mcpSettings.connectorEnabled.supabase && supabaseConn.isConnected,
        hasSelectedProject: mcpSettings.connectorEnabled.supabase && !!selectedProject,
        credentials: {
          supabaseUrl: mcpSettings.connectorEnabled.supabase ? supabaseConn?.credentials?.supabaseUrl : undefined,
          anonKey: mcpSettings.connectorEnabled.supabase ? supabaseConn?.credentials?.anonKey : undefined,
        },
      },
      maxLLMSteps: mcpSettings.maxLLMSteps,
      planMode: false,
      webSearchEnabled: mcpSettings.webSearchEnabled,
      connectorEnabled: mcpSettings.connectorEnabled,
      toolEnabled: mcpSettings.toolEnabled,
      plugins: installedPlugins
        .filter((plugin) => plugin.enabled)
        .map((plugin) => {
          const manifest = plugin.manifest as PluginManifest;
          const tools = manifest.tools.filter((tool) => plugin.configuration[`toolDisabled:${tool}`] !== true);

          return { id: plugin.id, adapter: manifest.contribution.adapter, tools };
        })
        .filter((plugin) => plugin.tools.length > 0),
    };

    const {
      messages,
      status,
      stop,
      sendMessage: sendChatMessage,
      setMessages,
      error,
      addToolOutput,
    } = useChat({
      transport: new DefaultChatTransport({
        api: '/api/chat',

        /*
         * body and headers are resolved per request, but only if they are
         * functions. Passing a plain object froze every value here at first
         * render, which silently staled chat mode and step limit.
         *
         * Keys go in `x-hypeable-key`, not the cookie and not the JSON body.
         */
        headers: () => getLlmRequestHeaders(),
        body: () => ({ ...bodyRef.current, planMode: planModeRef.current }),
      }),

      /*
       * v5 removed useChat's `data` array. data-progress parts now arrive here
       * instead, and ProgressCompilation renders whatever this holds.
       */
      onData: (part) => {
        if (part.type === 'data-usage') {
          costUsageRef.current(part.data);
        }

        const data = part.data as Partial<ProgressAnnotation> | undefined;

        if (data?.type === 'progress' && typeof data.label === 'string') {
          setProgressAnnotations((previous) => [
            ...previous.filter((annotation) => annotation.label !== data.label),
            data as ProgressAnnotation,
          ]);
        }
      },

      /*
       * v5's addToolOutput only re-POSTs when sendAutomaticallyWhen says so.
       * Without this, approving an MCP tool updated the UI locally and never
       * reached the server, stalling the conversation.
       */
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onError: (e) => {
        setFakeLoading(false);
        handleError(e, 'chat');
      },
      onFinish: ({ message }) => {
        setProgressAnnotations([]);

        if (planModeRef.current) {
          planModeRef.current = false;
          ingestPlanReply(getMessageText(message));
          setFakeLoading(false);
        }

        const userMessages = messagesRef.current.filter((item) => item.role === 'user');

        /*
         * Blank starts have no manifest to inspect until the first code response
         * has landed. Add the detected setup actions in code when the model did
         * not include its own install/start actions.
         */
        const hasNativeProjectTools = [...messagesRef.current, message].some((candidate) =>
          (getMessageParts(candidate) ?? []).some((part) => {
            const name = getToolName(part);
            return name !== undefined && PROJECT_TOOL_NAMES.includes(name as (typeof PROJECT_TOOL_NAMES)[number]);
          }),
        );

        if (
          userMessages.length === 1 &&
          !agentMode &&
          !hasNativeProjectTools &&
          !/<boltAction\s+type=["'](?:shell|start)["']/.test(getMessageText(message))
        ) {
          void (async () => {
            const completedMessages = messagesRef.current.some((item) => item.id === message.id)
              ? messagesRef.current
              : [...messagesRef.current, message];
            pendingTemplateParserRef.current(completedMessages, false);
            await workbenchStore.waitForExecutionQueue();

            const projectFiles = Object.entries(workbenchStore.files.get()).flatMap(([path, file]) =>
              file?.type === 'file' ? [{ path, content: file.content }] : [],
            );

            // A research-only conversation has no project to install or start.
            if (projectFiles.length === 0) {
              return;
            }

            const commands = await detectProjectCommands(projectFiles);
            const setupMessage = createCommandsMessage(commands);

            if (setupMessage) {
              setMessages((current) => [...current, setupMessage]);
            }
          })();
        }

        console.log('Chat response completed');
        logStore.logProvider('Chat response completed', {
          component: 'Chat',
          action: 'response',
          model,
          provider: provider.name,
          messageLength: getMessageText(message).length,
        });

        logger.debug('Finished streaming');
      },

      /*
       * `messages`, not `initialMessages`. The old key is spread into the Chat
       * constructor and discarded, so persisted history never reached the UI.
       */
      messages: initialMessages,
    });

    const isLoading = status === 'submitted' || status === 'streaming';
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const executingProjectCallsRef = useRef(new Set<string>());
    const projectToolControllersRef = useRef(new Map<string, AbortController>());
    const projectCallGenerationsRef = useRef(new Map<string, { generation: number; chatId?: string }>());
    const currentProjectGeneration = workbenchStore.projectGeneration.get();

    useEffect(() => {
      const unsubscribe = workbenchStore.projectGeneration.listen(() => {
        for (const controller of projectToolControllersRef.current.values()) {
          controller.abort();
        }
        projectToolControllersRef.current.clear();
      });

      return () => {
        unsubscribe();

        for (const controller of projectToolControllersRef.current.values()) {
          controller.abort();
        }
        projectToolControllersRef.current.clear();
      };
    }, []);

    for (const message of messages) {
      for (const part of getMessageParts(message) ?? []) {
        const callId = getToolCallId(part);
        const name = getToolName(part);

        if (
          callId &&
          name &&
          PROJECT_TOOL_NAMES.includes(name as (typeof PROJECT_TOOL_NAMES)[number]) &&
          !projectCallGenerationsRef.current.has(callId)
        ) {
          projectCallGenerationsRef.current.set(callId, { generation: currentProjectGeneration, chatId: chatId.get() });
        }
      }
    }

    const handleToolOutput = useCallback(
      (options: { tool: string; toolCallId: string; output: unknown }) => {
        const { tool, toolCallId, output } = options;

        // Await the server's result; a local approval would overwrite it and prematurely continue the chat.
        if (isServerAgentTool(tool)) {
          return;
        }

        if (tool.startsWith('plugin_')) {
          if (output !== TOOL_EXECUTION_APPROVAL.APPROVE) {
            addToolOutput({
              ...options,
              output: { isError: true, denied: true, error: 'Plugin tool execution was rejected.' },
            });
            return;
          }

          const call = messagesRef.current
            .flatMap((message) => getMessageParts(message) ?? [])
            .find((part) => isToolCallPart(part) && getToolCallId(part) === toolCallId);

          const input = call ? getToolInput(call) : undefined;

          void pluginDatabase
            .getAll()
            .then((installedPlugins) => {
              for (const installed of installedPlugins) {
                if (!installed.enabled) {
                  continue;
                }

                const parsed = pluginManifestSchema.safeParse(installed.manifest);

                if (!parsed.success || !isSupportedAdapter(parsed.data)) {
                  continue;
                }

                const manifest = parsed.data;
                const toolId = manifest.tools.find((candidate) => getPluginToolName(manifest.id, candidate) === tool);

                if (!toolId || installed.configuration[`toolDisabled:${toolId}`] === true) {
                  continue;
                }

                const result = executeTextUtility(toolId, input);
                addToolOutput({ tool, toolCallId, output: result });

                return;
              }

              addToolOutput({
                tool,
                toolCallId,
                output: { isError: true, error: 'This plugin tool is no longer installed, enabled, or permitted.' },
              });
            })
            .catch((error) => {
              addToolOutput({
                tool,
                toolCallId,
                output: { isError: true, error: error instanceof Error ? error.message : 'Plugin tool failed.' },
              });
            });

          return;
        }

        if (
          PROJECT_TOOL_NAMES.includes(tool as (typeof PROJECT_TOOL_NAMES)[number]) &&
          output === TOOL_EXECUTION_APPROVAL.REJECT &&
          executingProjectCallsRef.current.has(toolCallId)
        ) {
          return;
        }

        if (
          !PROJECT_TOOL_NAMES.includes(tool as (typeof PROJECT_TOOL_NAMES)[number]) ||
          output !== TOOL_EXECUTION_APPROVAL.APPROVE
        ) {
          addToolOutput(
            PROJECT_TOOL_NAMES.includes(tool as (typeof PROJECT_TOOL_NAMES)[number]) &&
              output === TOOL_EXECUTION_APPROVAL.REJECT
              ? { ...options, output: { isError: true, denied: true, error: 'Tool execution was rejected.' } }
              : options,
          );
          return;
        }

        if (executingProjectCallsRef.current.has(toolCallId)) {
          return;
        }

        let input: unknown;

        for (const message of messagesRef.current) {
          const parts = getMessageParts(message) ?? [];
          const call = parts.find((part) => isToolCallPart(part) && getToolCallId(part) === toolCallId);

          if (call) {
            input = getToolInput(call);
            break;
          }
        }

        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          addToolOutput({
            tool,
            toolCallId,
            output: { isError: true, error: 'Approved tool input was not available.' },
          });
          return;
        }

        executingProjectCallsRef.current.add(toolCallId);

        const origin = projectCallGenerationsRef.current.get(toolCallId);

        const executionContext = resolveProjectCallContext(
          origin,
          { generation: workbenchStore.projectGeneration.get(), chatId: chatId.get() },
          chatChanged,
        );

        if (origin && !executionContext) {
          addToolOutput({
            tool,
            toolCallId,
            output: { isError: true, error: 'The active project changed before this approval.' },
          });
          return;
        }

        const abortController = new AbortController();
        projectToolControllersRef.current.set(toolCallId, abortController);
        void callProjectMcpTool(tool, input as Record<string, unknown>, {
          signal: abortController.signal,
          generation: executionContext?.generation,
          chatId: executionContext?.chatId,
        })
          .then((result) => {
            if (abortController.signal.aborted) {
              return;
            }

            const mcpResult = result as unknown as {
              content?: Array<{ type: string; text?: string }>;
              structuredContent?: Record<string, unknown>;
              isError?: boolean;
            };
            const resultText = (mcpResult.content ?? [])
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join('\n');
            const toolOutput = mcpResult.isError
              ? {
                  ...mcpResult.structuredContent,
                  isError: true,
                  error: mcpResult.structuredContent?.error ?? (resultText || 'Project MCP tool failed.'),
                }
              : (mcpResult.structuredContent ?? { content: mcpResult.content ?? [] });
            addToolOutput({ tool, toolCallId, output: toolOutput });
          })
          .catch((error) => {
            if (abortController.signal.aborted) {
              return;
            }

            addToolOutput({
              tool,
              toolCallId,
              output: { isError: true, error: error instanceof Error ? error.message : String(error) },
            });
          })
          .finally(() => {
            executingProjectCallsRef.current.delete(toolCallId);
            projectToolControllersRef.current.delete(toolCallId);
          });
      },
      [addToolOutput, chatChanged],
    );

    useEffect(() => {
      const pendingMessage = pendingTemplateContinuationRef.current;

      if (
        !pendingMessage ||
        !messages.some((message) => getMessageText(message).includes('<boltArtifact id="imported-files"'))
      ) {
        return;
      }

      pendingTemplateContinuationRef.current = null;

      void (async () => {
        /*
         * Wait for imported files to reach the project before asking the model
         * to customize them. Dependency installation and server startup remain
         * queued afterward and do not delay the first response.
         */
        try {
          parseMessages(messages, false);
          await workbenchStore.waitForFileActions();
          await sendChatMessage(pendingMessage);
        } catch (error) {
          handleError(error, 'chat');
        } finally {
          setFakeLoading(false);
        }
      })();
    }, [messages, sendChatMessage]);

    useEffect(() => {
      const prompt = searchParams.get('prompt');

      // console.log(prompt, searchParams, model, provider);

      if (prompt) {
        setSearchParams({});
        runAnimation();
        void sendChatMessage(
          createMessage({
            role: 'user',
            text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${prompt}`,
          }) as any,
        );
      }
    }, [model, provider, searchParams]);

    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages, resetParsedMessages } = useMessageParser();
    pendingTemplateParserRef.current = parseMessages;

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    useEffect(() => {
      const sameChatRefresh = shouldPreserveChatMessagesOnRefresh({
        chatChanged,
        currentMessageCount: messagesRef.current.length,
        storedMessageCount: initialMessages.length,
        hasAppliedInitialMessages: hasAppliedInitialMessagesRef.current,
      });

      if (sameChatRefresh) {
        /*
         * Saving a new chat updates its route and re-reads the same messages.
         * Keep the live useChat state so this refresh cannot abort a new build.
         */
        setChatStarted(true);
        chatStore.setKey('started', true);

        return;
      }

      if (isLoading) {
        stop();
      }

      setMessages(initialMessages);

      const hasMessages = initialMessages.length > 0;
      setChatStarted(hasMessages);
      chatStore.setKey('started', hasMessages);
      setProgressAnnotations([]);
      resetEnhancer();

      if (!hasMessages) {
        setInput('');
      }

      /*
       * The parser only emits each artifact and action once per message id, so
       * only a genuine switch needs it rewound. A re-read of the same chat, e.g.
       * the route catching up with the chat just persisted, must leave it alone
       * or every action would run a second time.
       */
      if (chatChanged) {
        resetParsedMessages();
      }

      parseMessages(initialMessages, false);

      if (initialMessages.length > 0) {
        hasAppliedInitialMessagesRef.current = true;
      }
    }, [initialMessages, chatChanged]);

    useEffect(() => {
      const starterSetupMessage = initialMessages.find((message) =>
        getMessageText(message).includes('<boltArtifact id="project-setup"'),
      );

      if (
        !starterSetupMessage?.id ||
        parsedStarterSetupMessagesRef.current.has(starterSetupMessage.id) ||
        !initialMessages.some((message) => getMessageText(message).includes('<boltArtifact id="imported-files"'))
      ) {
        return undefined;
      }

      let cancelled = false;

      void workbenchStore.waitForFileActions().then(() => {
        if (!cancelled && !parsedStarterSetupMessagesRef.current.has(starterSetupMessage.id!)) {
          parsedStarterSetupMessagesRef.current.add(starterSetupMessage.id!);
          parseMessages(initialMessages, false);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [initialMessages, parseMessages]);

    /*
     * Pre-fill the textarea with the follow-up prompt set by ImportZipButton before the
     * full-page navigation. Using setInput instead of append so the user confirms with
     * one Enter keystroke — avoids model-state race conditions on chat initialisation.
     */
    useEffect(() => {
      if (initialMessages.length === 0) {
        return;
      }

      const autorun = localStorage.getItem('bolt_zip_autorun');

      if (autorun) {
        localStorage.removeItem('bolt_zip_autorun');
        setInput(autorun);
      }
    }, []);

    useEffect(() => {
      if (!import.meta.env.DEV) {
        return;
      }

      if (new URLSearchParams(window.location.search).get('debugStarted') !== '1') {
        return;
      }

      setChatStarted(true);
      chatStore.setKey('started', true);
    }, []);

    useEffect(() => {
      if (!import.meta.env.DEV) {
        return;
      }

      void import('~/lib/deploy/debug-deploy').then((mod) => mod.runDebugDeployOnce());
    }, []);

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        isLoading,
        isPreparingProject: fakeLoading,
        parseMessages,
        storeMessageHistory,
      });
    }, [messages, isLoading, fakeLoading, parseMessages]);

    const scrollTextArea = () => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    };

    const abort = () => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();

      logStore.logProvider('Chat response aborted', {
        component: 'Chat',
        action: 'abort',
        model,
        provider: provider.name,
      });
    };

    const { beforeSend, onUsage, onStreamEnd } = useCostGuard({
      model,
      provider: provider.name,
      messages,
      isStreaming: isLoading,
      abort,
    });
    costUsageRef.current = onUsage;

    const { noteUserMessage } = useLoopBreaker({
      abort,
      chatId: currentChatId,
      messages,
      actionAlert,
      deployAlert,
    });

    const wasStreamingRef = useRef(false);

    useEffect(() => {
      if (wasStreamingRef.current && !isLoading) {
        onStreamEnd();
      }

      wasStreamingRef.current = isLoading;
    }, [isLoading, onStreamEnd]);

    const handleError = useCallback(
      (error: any, context: 'chat' | 'template' | 'llmcall' = 'chat') => {
        logger.error(`${context} request failed`, error);

        stop();
        setFakeLoading(false);

        let errorInfo = {
          message: 'An unexpected error occurred',
          isRetryable: true,
          statusCode: 500,
          provider: provider.name,
          type: 'unknown' as const,
          retryDelay: 0,
        };

        if (error.message) {
          try {
            const parsed = JSON.parse(error.message);

            if (parsed.error || parsed.message) {
              errorInfo = { ...errorInfo, ...parsed };
            } else {
              errorInfo.message = error.message;
            }
          } catch {
            errorInfo.message = error.message;
          }
        }

        const classified = classifyUserError({
          statusCode: errorInfo.statusCode,
          message: errorInfo.message,
          online: typeof navigator === 'undefined' ? true : navigator.onLine,
        });

        let errorType: LlmErrorAlertType['errorType'] = 'unknown';

        const title = classified.title;

        if (classified.kind === 'no_key' || classified.kind === 'invalid_key') {
          errorType = 'authentication';
        } else if (classified.kind === 'rate_limit') {
          errorType = 'rate_limit';
        } else if (classified.kind === 'no_credit') {
          errorType = 'quota';
        } else if (
          classified.kind === 'offline' ||
          classified.kind === 'provider_down' ||
          classified.kind === 'timeout'
        ) {
          errorType = 'network';
        }

        errorInfo.message = classified.message;

        logStore.logError(`${context} request failed`, error, {
          component: 'Chat',
          action: 'request',
          error: errorInfo.message,
          context,
          retryable: errorInfo.isRetryable,
          errorType,
          provider: provider.name,
        });

        // Create API error alert
        setLlmErrorAlert({
          type: 'error',
          title,
          description: errorInfo.message,
          provider: provider.name,
          errorType,
        });
        setProgressAnnotations([]);
      },
      [provider.name, stop],
    );

    const clearApiErrorAlert = useCallback(() => {
      setLlmErrorAlert(undefined);
    }, []);

    useEffect(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.style.height = 'auto';

        const scrollHeight = textarea.scrollHeight;

        textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
        textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }, [input, textareaRef]);

    const runAnimation = async () => {
      if (chatStarted) {
        return;
      }

      if (!suppressHome) {
        await Promise.all([
          animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
          animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
        ]);
      }

      chatStore.setKey('started', true);

      setChatStarted(true);
    };

    // Helper function to create message parts array from text and images
    const createMessageParts = (text: string, images: string[] = []): AnyPart[] => {
      const parts: AnyPart[] = [
        {
          type: 'text',
          text,
        },
      ];

      // Add image parts if any
      images.forEach((imageData) => {
        // Extract correct MIME type from the data URL
        const mediaType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';

        /*
         * v5 shape: mediaType plus a complete data URL. v4 stored bare base64
         * in `data`, which v5 cannot parse because it calls new URL(part.url).
         */
        parts.push({
          type: 'file',
          mediaType,
          url: imageData,
        });
      });

      return parts;
    };

    /*
     * v5 removed the Attachment type and the experimental_attachments option.
     * Uploaded files now travel as `file` parts on the message itself, with a
     * complete data URL in `url` because the server calls new URL() on it.
     */
    const filesToFileParts = async (files: File[]): Promise<AnyPart[]> => {
      if (files.length === 0) {
        return [];
      }

      return Promise.all(
        files.map(
          (file) =>
            new Promise<AnyPart>((resolve) => {
              const reader = new FileReader();

              reader.onloadend = () => {
                resolve({
                  type: 'file',
                  mediaType: file.type,
                  filename: file.name,
                  url: reader.result as string,
                });
              };
              reader.readAsDataURL(file);
            }),
        ),
      );
    };

    const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
      const messageContent = messageInput || input;

      if (!messageContent?.trim()) {
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const copy = classifyUserError({ online: false });
        setLlmErrorAlert({
          type: 'error',
          title: copy.title,
          description: copy.message,
          provider: provider.name,
          errorType: 'network',
        });

        return;
      }

      if (Object.keys(readStoredApiKeys()).length === 0) {
        const copy = classifyUserError({ message: 'Add an API key' });
        setLlmErrorAlert({
          type: 'error',
          title: copy.title,
          description: copy.message,
          provider: provider.name,
          errorType: 'authentication',
        });

        return;
      }

      if (isLoading) {
        abort();
        return;
      }

      if (!costBypassRef.current) {
        const gate = beforeSend(messageContent, () => {
          costBypassRef.current = true;
          void sendMessage(_event, messageInput);
        });

        if (gate !== 'send') {
          return;
        }
      }

      costBypassRef.current = false;
      void bootWebContainer();
      noteUserMessage(messageContent, messages.at(-1)?.id);

      const { skipThisTurn, forcePlan } = consumePlanTurnFlags();
      const planSettings = planSettingsStore.get();

      const gated = shouldPlanThisTurn({
        planModeEnabled: planSettings.enabled,
        planEveryRequest: planSettings.everyRequest,
        skipThisTurn,
        forcePlan,
        isFirstBuildRequest: isFirstBuildRequest(messages.filter((item) => item.role === 'user').length),
        workspaceEmpty: isWorkspaceEmpty(workbenchStore.filesCount),
        chatMode,
      });

      planModeRef.current = gated;
      bodyRef.current = { ...bodyRef.current, planMode: gated };

      if (gated) {
        rememberPlanningPrompt(messageContent);
      }

      let finalMessageContent = messageContent;

      if (selectedElement) {
        const encodedElement = encodeURIComponent(JSON.stringify(selectedElement)).replace(/'/g, '%27');
        const elementInfo = `<div class=\"__boltSelectedElement__\" data-element=\"${encodedElement}\"></div>`;

        const visualEditPrompt = selectedElement.visualEdits?.length
          ? `\nPlease apply these visual edits to the selected element in the project source: ${selectedElement.visualEdits
              .map(({ property, value }) => `${property} = ${JSON.stringify(value)}`)
              .join(', ')}.`
          : '';
        finalMessageContent = `${messageContent}${visualEditPrompt}${elementInfo}`;
      }

      runAnimation();

      if (!chatStarted) {
        setFakeLoading(true);

        if (autoSelectTemplate && !gated) {
          const { template, title } = await selectStarterTemplate({
            message: finalMessageContent,
            model,
            provider,
          });

          if (template !== 'blank') {
            const temResp = await getTemplates(template, title).catch((e) => {
              if (e.message.includes('rate limit')) {
                toast.warning('Rate limit exceeded. Skipping starter template\n Continuing with blank template');
              } else {
                toast.warning('Failed to import starter template\n Continuing with blank template');
              }

              return null;
            });

            if (temResp) {
              const { assistantMessage, userMessage } = temResp;
              const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

              pendingTemplateContinuationRef.current = createMessage({
                role: 'user',
                text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}\n\nOriginal request:\n${finalMessageContent}`,
                flags: ['hidden', STARTER_BUILD_FLAG],
              }) as unknown as UIMessage;

              setMessages([
                {
                  id: `1-${new Date().getTime()}`,
                  role: 'user',
                  content: userMessageText,
                  parts: createMessageParts(userMessageText, imageDataList),
                },
                {
                  id: `2-${new Date().getTime()}`,
                  role: 'assistant',
                  content: assistantMessage,
                  parts: [{ type: 'text', text: assistantMessage }],
                },
              ] as any);
              setInput('');
              removePref('cachedPrompt');

              setUploadedFiles([]);
              setImageDataList([]);

              resetEnhancer();

              textareaRef.current?.blur();

              return;
            }
          }
        }

        // If autoSelectTemplate is disabled or template selection failed, proceed with normal message
        const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;
        const fileParts = await filesToFileParts(uploadedFiles);

        void sendChatMessage({
          id: `${new Date().getTime()}`,
          role: 'user',
          content: userMessageText,
          parts: [...createMessageParts(userMessageText, imageDataList), ...fileParts],
        } as any);
        setFakeLoading(false);
        setInput('');
        removePref('cachedPrompt');

        setUploadedFiles([]);
        setImageDataList([]);

        resetEnhancer();

        textareaRef.current?.blur();

        return;
      }

      if (error != null) {
        setMessages(messages.slice(0, -1));
      }

      const modifiedFiles = workbenchStore.getModifiedFiles();

      chatStore.setKey('aborted', false);

      if (modifiedFiles !== undefined) {
        const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
        const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userUpdateArtifact}${finalMessageContent}`;

        void sendChatMessage((await buildUserMessage(messageText)) as any);

        workbenchStore.resetAllFileModifications();
      } else {
        const messageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${finalMessageContent}`;

        void sendChatMessage((await buildUserMessage(messageText)) as any);
      }

      setInput('');
      removePref('cachedPrompt');

      setUploadedFiles([]);
      setImageDataList([]);

      resetEnhancer();

      textareaRef.current?.blur();
    };

    const sendMessageRef = useRef(sendMessage);
    sendMessageRef.current = sendMessage;

    const handledSendNonceRef = useRef(0);

    useEffect(() => {
      const handler = (event: Event) => {
        const message = (event as CustomEvent<{ message?: string }>).detail?.message;

        if (message?.trim()) {
          void sendMessageRef.current({} as never, message);
        }
      };

      document.addEventListener('hypeable-send-chat', handler);

      return () => document.removeEventListener('hypeable-send-chat', handler);
    }, []);

    useEffect(() => {
      return homeComposerSendNonce.subscribe((nonce) => {
        if (nonce === 0 || nonce <= handledSendNonceRef.current) {
          return;
        }

        handledSendNonceRef.current = nonce;

        const text = homeComposerDraft.get();

        if (text.trim()) {
          void sendMessageRef.current({} as never, text);
        }
      });
    }, []);

    /*
     * Builds a user message carrying its images and uploads. v5 removed
     * experimental_attachments, so file parts must be part of the message
     * itself; omitting them silently dropped every paste and upload, because
     * the state is cleared right after sending.
     */
    const buildUserMessage = async (text: string): Promise<UIMessage> => {
      const fileParts = await filesToFileParts(uploadedFiles);

      return {
        ...createMessage({ role: 'user', text }),
        parts: [...createMessageParts(text, imageDataList), ...fileParts],
      } as unknown as UIMessage;
    };

    /**
     * Handles the change event for the textarea and updates the input state.
     * @param event - The change event from the textarea.
     */
    const onTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    };

    /**
     * Debounced draft cache. localStorage, never a cookie — drafts are user text.
     */
    const debouncedCachePrompt = useCallback(
      debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const trimmedValue = event.target.value.trim();

        if (trimmedValue) {
          writePref('cachedPrompt', trimmedValue);
        } else {
          removePref('cachedPrompt');
        }
      }, 1000),
      [],
    );

    useEffect(() => {
      setApiKeys(readStoredApiKeys());

      const handleApiKeysUpdated = (event: Event) => {
        const { apiKeys } = (event as CustomEvent<ApiKeysUpdatedDetail>).detail;
        setApiKeys(apiKeys);
      };

      window.addEventListener(API_KEYS_UPDATED_EVENT, handleApiKeysUpdated);

      return () => window.removeEventListener(API_KEYS_UPDATED_EVENT, handleApiKeysUpdated);
    }, []);

    const handleModelChange = (newModel: string) => {
      setModel(newModel);
      writePref('selectedModel', newModel);
    };

    const handleProviderChange = (newProvider: ProviderInfo) => {
      setProvider(newProvider);
      writePref('selectedProvider', newProvider.name);
    };

    useEffect(() => {
      homeChatRuntime.set({
        ready: true,
        providerList: activeProviders,
        provider,
        model,
        setProvider: handleProviderChange,
        setModel: handleModelChange,
        sendMessage: (event, messageInput) => {
          void sendMessageRef.current(event, messageInput);
        },
        enhancePrompt: () => {
          enhancePrompt(
            homeComposerDraft.get() || input,
            (nextInput) => {
              setInput(nextInput);
              scrollTextArea();
            },
            model,
            provider,
            apiKeys,
          );
        },
        llmErrorAlert,
        clearLlmErrorAlert: clearApiErrorAlert,
      });
    }, [activeProviders, provider, model, apiKeys, enhancePrompt, llmErrorAlert, clearApiErrorAlert]);

    useEffect(() => {
      return () => {
        homeChatRuntime.set(emptyHomeChatRuntime);
      };
    }, []);

    if (suppressHome && !chatStarted) {
      return null;
    }

    return (
      <BaseChat
        ref={animationScope}
        textareaRef={textareaRef}
        input={input}
        showChat={showChat}
        chatStarted={chatStarted}
        isStreaming={isLoading || fakeLoading}
        onStreamingChange={(streaming) => {
          streamingState.set(streaming);
        }}
        enhancingPrompt={enhancingPrompt}
        promptEnhanced={promptEnhanced}
        sendMessage={sendMessage}
        fillPrompt={(text) => {
          homeComposerDraft.set(text);
          setInput(text);
          textareaRef.current?.focus();
        }}
        model={model}
        setModel={handleModelChange}
        provider={provider}
        setProvider={handleProviderChange}
        providerList={activeProviders}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleStop={abort}
        description={description}
        importChat={importChat}
        exportChat={exportChat}
        messages={messages.map((message, i) => {
          if (message.role === 'user') {
            return message;
          }

          return {
            ...message,
            parsedContent: parsedMessages[i] || '',
          };
        })}

        /*
         * Markdown's quick-action buttons (__boltQuickAction__) call append to
         * re-send a message. Without this they rendered but did nothing.
         */
        append={(message) => sendChatMessage(message as UIMessage)}
        enhancePrompt={() => {
          enhancePrompt(
            input,
            (input) => {
              setInput(input);
              scrollTextArea();
            },
            model,
            provider,
            apiKeys,
          );
        }}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        actionAlert={actionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        deployAlert={deployAlert}
        _clearDeployAlert={() => workbenchStore.clearDeployAlert()}
        llmErrorAlert={llmErrorAlert}
        clearLlmErrorAlert={clearApiErrorAlert}
        progressAnnotations={progressAnnotations}
        chatMode={chatMode}
        setChatMode={setChatMode}
        agentMode={agentMode}
        setAgentMode={(enabled) => {
          setAgentMode(enabled);
          writePref('agentMode', String(enabled));
        }}
        designScheme={designScheme}
        setDesignScheme={setDesignScheme}
        selectedElement={selectedElement}
        setSelectedElement={setSelectedElement}
        addToolOutput={handleToolOutput}
      />
    );
  },
);
