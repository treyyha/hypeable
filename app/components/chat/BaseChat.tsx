import { useStore } from '@nanostores/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { UIMessage } from 'ai';
import React, { lazy, Suspense, type RefCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import styles from './BaseChat.module.scss';
import ChatAlert from './ChatAlert';
import { ChatBox } from './ChatBox';
import LlmErrorAlert from './LLMApiAlert';
import type { DisplayMessage } from './Messages.client';
import { BrowserSupportBanner } from '~/components/browser/BrowserSupportBanner';
import { ExamplePrompts } from '~/components/chat/ExamplePrompts';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import { HomeHero } from '~/components/home/HomeHero';
import { MoreWaysToStart } from '~/components/home/MoreWaysToStart';
import { RecentProjects } from '~/components/home/RecentProjects';
import { SpendCard } from '~/components/home/SpendCard';
import { LoopBreakerHost } from '~/components/loop/LoopBreakerHost';
import { OpenRouterToastHost } from '~/components/onboarding/OpenRouterToastHost';
import { StartInSixty } from '~/components/onboarding/StartInSixty';
import { PlanHost } from '~/components/plan/PlanHost';
import { Aurora } from '~/components/ui/Aurora';
import { BrandFooter } from '~/components/ui/BrandFooter';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { WorkbenchReopenButton } from '~/components/workbench/WorkbenchReopenButton';
import { llmFetch, readStoredApiKeys, writeStoredApiKeys } from '~/lib/api/api-key-storage';
import { API_KEYS_UPDATED_EVENT, type ApiKeysUpdatedDetail } from '~/lib/api/apiKeys';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks/StickToBottom';
import useViewport from '~/lib/hooks/useViewport';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { prefetchWorkbench } from '~/lib/performance/prefetch-home';
import { homeComposerDraft, requestHomeComposerSend, setHomeComposerDraft } from '~/lib/stores/home-composer';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import type { ActionAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import type { ProgressAnnotation } from '~/types/context';
import type { DesignScheme } from '~/types/design-scheme';
import type { ProviderInfo } from '~/types/model';
import { classNames } from '~/utils/classNames';

const LazyWorkbench = lazy(() =>
  import('~/components/workbench/Workbench.client').then((m) => ({ default: m.Workbench })),
);

const Messages = lazy(() => import('./Messages.client').then((m) => ({ default: m.Messages })));

const MobilePaneTabs = lazy(() =>
  import('~/components/workbench/MobilePaneTabs').then((m) => ({ default: m.MobilePaneTabs })),
);

const ProgressCompilation = lazy(() => import('./ProgressCompilation'));
const ToolApprovalTray = lazy(() => import('./ToolApprovalTray').then((m) => ({ default: m.ToolApprovalTray })));

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement | null> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: DisplayMessage[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  fillPrompt?: (text: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: UIMessage[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  deployAlert?: DeployAlert;
  _clearDeployAlert?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
  progressAnnotations?: ProgressAnnotation[];
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  agentMode?: boolean;
  setAgentMode?: (enabled: boolean) => void;
  append?: (message: UIMessage) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: (element: ElementInfo | null) => void;
  addToolOutput?: (options: { tool: string; toolCallId: string; output: unknown }) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      fillPrompt,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      deployAlert,
      _clearDeployAlert,
      llmErrorAlert,
      clearLlmErrorAlert,
      progressAnnotations: incomingProgressAnnotations,
      chatMode,
      setChatMode,
      agentMode,
      setAgentMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
      addToolOutput = () => {
        throw new Error('addToolOutput not implemented');
      },
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const draft = useStore(homeComposerDraft);
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');

    const expoUrl = useStore(expoUrlAtom);
    const [showWorkbench, setShowWorkbench] = useState(true);
    const isSmallViewport = useViewport(1024);
    const [qrModalOpen, setQrModalOpen] = useState(false);

    useEffect(() => {
      if (!chatStarted || typeof window === 'undefined') {
        return;
      }

      if (window.matchMedia('(max-width: 1023px)').matches) {
        void import('~/lib/stores/mobile-pane').then(({ setMobilePane }) => setMobilePane('chat'));
      }
    }, [chatStarted]);

    useEffect(() => {
      if (!chatStarted) {
        return undefined;
      }

      let unsub: (() => void) | undefined;

      void import('~/lib/stores/workbench').then(({ workbenchStore }) => {
        setShowWorkbench(workbenchStore.showWorkbench.get());
        unsub = workbenchStore.showWorkbench.subscribe(setShowWorkbench);
      });

      return () => unsub?.();
    }, [chatStarted]);

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = readStoredApiKeys();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys:', error);
        }

        setIsModelLoading('all');

        if (!providerList?.length) {
          setModelList([]);
          setIsModelLoading(undefined);

          return;
        }

        const activeProviderNames = providerList.map((activeProvider) => activeProvider.name).join(',');

        llmFetch(`/api/models?providers=${encodeURIComponent(activeProviderNames)}`)
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      if ((apiKeys[providerName] || '') === apiKey) {
        return;
      }

      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      writeStoredApiKeys(newApiKeys, providerName);

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await llmFetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    useEffect(() => {
      const handleApiKeysUpdated = (event: Event) => {
        const { apiKeys, providerName } = (event as CustomEvent<ApiKeysUpdatedDetail>).detail;
        setApiKeys(apiKeys);
        setIsModelLoading(providerName);

        llmFetch(`/api/models/${encodeURIComponent(providerName)}`)
          .then((response) => response.json())
          .then((data) => {
            const providerModels = (data as { modelList: ModelInfo[] }).modelList;
            setModelList((currentModels) => [
              ...currentModels.filter((model) => model.provider !== providerName),
              ...providerModels,
            ]);
          })
          .catch((error) => {
            console.error('Error loading dynamic models for:', providerName, error);
          })
          .finally(() => setIsModelLoading(undefined));
      };

      window.addEventListener(API_KEYS_UPDATED_EVENT, handleApiKeysUpdated);

      return () => window.removeEventListener(API_KEYS_UPDATED_EVENT, handleApiKeysUpdated);
    }, []);

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const composerInput = handleInputChange ? input : draft;

    const onComposerChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setHomeComposerDraft(event.target.value);
      handleInputChange?.(event);
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (!sendMessage) {
        requestHomeComposerSend();
        return;
      }

      sendMessage(event, messageInput);
      setSelectedElement?.(null);
      setHomeComposerDraft('');

      if (recognition) {
        recognition.abort(); // Stop current recognition
        setTranscript(''); // Clear transcript
        setIsListening(false);

        // Clear the input by triggering handleInputChange with empty value
        if (handleInputChange) {
          const syntheticEvent = {
            target: { value: '' },
          } as React.ChangeEvent<HTMLTextAreaElement>;
          handleInputChange(syntheticEvent);
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
        data-chat-ready={sendMessage ? 'true' : undefined}
      >
        {chatStarted && showChat && !showWorkbench && !isSmallViewport && (
          <WorkbenchReopenButton
            onClick={() => {
              void import('~/lib/stores/workbench').then(({ workbenchStore }) => {
                workbenchStore.showWorkbench.set(true);
              });
            }}
          />
        )}
        <div className="flex h-full min-w-0 w-full flex-col overflow-hidden lg:flex-row">
          <div
            className={classNames(
              styles.Chat,
              'relative flex h-full min-h-0 flex-grow flex-col overflow-hidden lg:min-w-[var(--chat-min-width)]',
            )}
            data-testid="home-main"
          >
            {!chatStarted && <Aurora data-testid="home-aurora" />}
            <BrowserSupportBanner />
            <div
              className={classNames(
                'relative z-[1] flex min-h-0 flex-1 flex-col',
                chatStarted ? 'overflow-hidden pb-14 lg:pb-0' : 'overflow-y-auto',
              )}
            >
              {!chatStarted && <HomeHero />}
              <OpenRouterToastHost />
              {!chatStarted && Object.keys(apiKeys).length === 0 && (
                <div className="relative z-[1] mx-auto mt-6 w-full px-4">
                  <StartInSixty />
                </div>
              )}
              <StickToBottom
                className={classNames('relative z-[1] px-2 pt-6 sm:px-6', {
                  'h-full flex flex-col modern-scrollbar': chatStarted,
                })}
                resize="smooth"
                initial="smooth"
              >
                <StickToBottom.Content className="flex flex-col gap-4 relative ">
                  <ClientOnly>
                    {() => {
                      return chatStarted ? (
                        <Suspense fallback={null}>
                          <Messages
                            className="flex flex-col w-full flex-1 max-w-chat pb-4 mx-auto z-1"
                            messages={messages}
                            isStreaming={isStreaming}
                            append={append}
                            chatMode={chatMode}
                            setChatMode={setChatMode}
                            provider={provider}
                            model={model}
                            addToolResult={addToolOutput}
                          />
                        </Suspense>
                      ) : null;
                    }}
                  </ClientOnly>
                  <ScrollToBottom />
                </StickToBottom.Content>
                <div
                  className={classNames('z-prompt mx-auto my-auto mb-6 flex w-full flex-col gap-2', {
                    'sticky bottom-2': chatStarted,
                    'max-w-chat': chatStarted,
                    'max-w-[520px]': !chatStarted,
                  })}
                >
                  <div className="flex flex-col gap-2">
                    <LoopBreakerHost
                      sendMessage={(text) => sendMessage?.({} as never, text)}
                      currentModel={model}
                      currentProvider={provider?.name}
                      models={modelList}
                      apiKeys={apiKeys}
                    />
                    <PlanHost
                      sendMessage={(text) => sendMessage?.({} as never, text)}
                      model={model ?? ''}
                      provider={provider?.name}
                    />
                    {deployAlert && (
                      <DeployChatAlert
                        alert={deployAlert}
                        clearAlert={() => _clearDeployAlert?.()}
                        postMessage={(message: string | undefined) => {
                          sendMessage?.({} as any, message);
                        }}
                      />
                    )}
                    {actionAlert && (
                      <ChatAlert
                        alert={actionAlert}
                        clearAlert={() => clearAlert?.()}
                        postMessage={(message) => {
                          sendMessage?.({} as any, message);
                          clearAlert?.();
                        }}
                      />
                    )}
                    {llmErrorAlert && <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />}
                  </div>
                  {chatStarted ? (
                    <Suspense fallback={null}>
                      <ToolApprovalTray messages={messages} addToolOutput={addToolOutput} />
                    </Suspense>
                  ) : null}
                  {incomingProgressAnnotations ? (
                    <Suspense fallback={null}>
                      <ProgressCompilation data={incomingProgressAnnotations} />
                    </Suspense>
                  ) : null}
                  <ChatBox
                    provider={provider}
                    setProvider={setProvider}
                    providerList={providerList || []}
                    onComposerFocus={prefetchWorkbench}
                    model={model}
                    setModel={setModel}
                    modelList={modelList}
                    apiKeys={apiKeys}
                    isModelLoading={isModelLoading}
                    onApiKeysChange={onApiKeysChange}
                    uploadedFiles={uploadedFiles}
                    setUploadedFiles={setUploadedFiles}
                    imageDataList={imageDataList}
                    setImageDataList={setImageDataList}
                    textareaRef={textareaRef}
                    input={composerInput}
                    handleInputChange={onComposerChange}
                    handlePaste={handlePaste}
                    TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
                    TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
                    isStreaming={isStreaming}
                    handleStop={handleStop}
                    handleSendMessage={handleSendMessage}
                    enhancingPrompt={enhancingPrompt}
                    enhancePrompt={enhancePrompt}
                    isListening={isListening}
                    startListening={startListening}
                    stopListening={stopListening}
                    chatStarted={chatStarted}
                    exportChat={exportChat}
                    qrModalOpen={qrModalOpen}
                    setQrModalOpen={setQrModalOpen}
                    handleFileUpload={handleFileUpload}
                    chatMode={chatMode}
                    setChatMode={setChatMode}
                    agentMode={agentMode}
                    setAgentMode={setAgentMode}
                    designScheme={designScheme}
                    setDesignScheme={setDesignScheme}
                    selectedElement={selectedElement}
                    setSelectedElement={setSelectedElement}
                  />
                </div>
              </StickToBottom>
              {!chatStarted && (
                <div className="flex flex-col gap-4 pb-6">
                  <ExamplePrompts
                    onFill={(text) => {
                      setHomeComposerDraft(text);
                      fillPrompt?.(text);
                    }}
                  />
                  <MoreWaysToStart importChat={importChat} />
                </div>
              )}
              {!chatStarted && (
                <div className="relative z-[1] flex flex-col gap-4">
                  <div className="mx-auto grid w-full max-w-chat items-stretch gap-4 px-4 pb-2 sm:grid-cols-[1fr_16rem]">
                    <RecentProjects />
                    <SpendCard />
                  </div>
                  <BrandFooter className="mt-4 mb-4" />
                </div>
              )}
            </div>
          </div>
          {chatStarted && (
            <ClientOnly>
              {() => (
                <Suspense fallback={null}>
                  <LazyWorkbench
                    chatStarted={chatStarted}
                    isStreaming={isStreaming}
                    selectedElement={selectedElement}
                    setSelectedElement={setSelectedElement}
                    exportChat={exportChat}
                  />
                </Suspense>
              )}
            </ClientOnly>
          )}
          {chatStarted && (
            <Suspense fallback={null}>
              <MobilePaneTabs />
            </Suspense>
          )}
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <>
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-bolt-elements-background-depth-1 to-transparent h-20 z-10" />
        <button
          className="sticky z-50 bottom-0 left-0 right-0 text-4xl rounded-lg px-1.5 py-0.5 flex items-center justify-center mx-auto gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
          onClick={() => scrollToBottom()}
        >
          Go to last message
          <span className="i-ph:arrow-down animate-bounce" />
        </button>
      </>
    )
  );
}
