import { useStore } from '@nanostores/react';
import React from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { AttachmentMenu } from './AttachmentMenu';
import FilePreview from './FilePreview';
import { McpTools } from './MCPTools';
import { ModelKeyPopover } from './ModelKeyPopover';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { SendButton } from './SendButton.client';
import { SupabaseConnection } from './SupabaseConnection';
import { PlanFirstChip } from '~/components/plan/PlanFirstChip';
import { Chip } from '~/components/ui/Chip';
import { ColorSchemeDialog } from '~/components/ui/ColorSchemeDialog';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { formatDollars } from '~/lib/cost/calc';
import { estimateRequestCost } from '~/lib/stores/cost';
import { isGitHubConnected } from '~/lib/stores/githubConnection';
import { isGitLabConnected } from '~/lib/stores/gitlabConnection';
import { OPEN_MODEL_PICKER_EVENT } from '~/lib/stores/loop';
import { useMCPStore, type ConnectorId } from '~/lib/stores/mcp';
import { netlifyConnection } from '~/lib/stores/netlify';
import { supabaseConnection } from '~/lib/stores/supabase';
import { vercelConnection } from '~/lib/stores/vercel';
import type { DesignScheme } from '~/types/design-scheme';
import type { ProviderInfo } from '~/types/model';
import { classNames } from '~/utils/classNames';

interface ChatBoxProps {
  provider: any;
  providerList: any[];
  modelList: any[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  agentMode?: boolean;
  setAgentMode?: (enabled: boolean) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
}

export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  const [isMcpToolsOpen, setIsMcpToolsOpen] = React.useState(false);
  const mcpToolsInitialized = useMCPStore((state) => state.isInitialized);
  const mcpSettings = useMCPStore((state) => state.settings);
  const setWebSearchEnabled = useMCPStore((state) => state.setWebSearchEnabled);
  const setConnectorEnabled = useMCPStore((state) => state.setConnectorEnabled);
  const serverTools = useMCPStore((state) => state.serverTools);
  const supabaseConnectionState = useStore(supabaseConnection);
  const supabaseConnected = !!supabaseConnectionState.isConnected;
  const githubConnected = useStore(isGitHubConnected);
  const gitlabConnected = useStore(isGitLabConnected);
  const vercelConnected = !!useStore(vercelConnection).user;
  const netlifyConnected = !!useStore(netlifyConnection).user;
  const browserUseCloudAvailable = serverTools['browser-use-cloud']?.status === 'available';

  const connectors = (
    [
      { id: 'github', name: 'GitHub', icon: <div className="i-ph:github-logo text-lg" />, available: githubConnected },
      {
        id: 'gitlab',
        name: 'GitLab',
        icon: <div className="i-ph:gitlab-logo text-lg" />,
        available: gitlabConnected,
      },
      {
        id: 'vercel',
        name: 'Vercel',
        icon: <div className="i-ph:triangle text-lg" />,
        available: vercelConnected,
      },
      {
        id: 'netlify',
        name: 'Netlify',
        icon: <div className="i-ph:cloud text-lg" />,
        available: netlifyConnected,
      },
      {
        id: 'supabase',
        name: 'Supabase',
        icon: <img className="w-4 h-4" height="16" width="16" src="https://cdn.simpleicons.org/supabase" alt="" />,
        available: supabaseConnected,
      },
      {
        id: 'browserUseCloud',
        name: 'Browser Use Cloud',
        icon: <div className="i-ph:browser text-lg" />,
        available: browserUseCloudAvailable,
      },
    ] as { id: ConnectorId; name: string; icon: React.ReactNode; available: boolean }[]
  )
    .filter((connector) => connector.available)
    .map(({ available: _available, ...connector }) => ({
      ...connector,
      enabled: mcpSettings.connectorEnabled[connector.id],
    }));

  React.useEffect(() => {
    const availability: Record<ConnectorId, boolean> = {
      github: githubConnected,
      gitlab: gitlabConnected,
      vercel: vercelConnected,
      netlify: netlifyConnected,
      supabase: supabaseConnected,
      browserUseCloud: browserUseCloudAvailable,
    };

    for (const [connector, available] of Object.entries(availability) as [ConnectorId, boolean][]) {
      if (!available && mcpSettings.connectorEnabled[connector]) {
        setConnectorEnabled(connector, false);
      }
    }
  }, [
    githubConnected,
    gitlabConnected,
    vercelConnected,
    netlifyConnected,
    browserUseCloudAvailable,
    mcpSettings.connectorEnabled.github,
    mcpSettings.connectorEnabled,
    setConnectorEnabled,
    supabaseConnected,
  ]);

  const [modelKeyOpen, setModelKeyOpen] = React.useState(false);

  React.useEffect(() => {
    const onOpenPicker = (event: Event) => {
      const detail = (event as CustomEvent<{ model?: string; provider?: string }>).detail ?? {};
      setModelKeyOpen(true);

      if (detail.model) {
        props.setModel?.(detail.model);
      }

      if (detail.provider) {
        const match = (props.providerList || []).find((entry: ProviderInfo) => entry.name === detail.provider);

        if (match) {
          props.setProvider?.(match);
        }
      }
    };

    window.addEventListener(OPEN_MODEL_PICKER_EVENT, onOpenPicker);

    return () => window.removeEventListener(OPEN_MODEL_PICKER_EVENT, onOpenPicker);
  }, [props.providerList, props.setModel, props.setProvider]);

  const canSend = props.input.length > 0 || props.uploadedFiles.length > 0;

  return (
    <div
      className={classNames(
        'hype-composer relative z-[1] mx-auto w-full p-3',
        props.chatStarted ? 'max-w-chat' : 'max-w-[520px]',
      )}
    >
      <FilePreview
        files={props.uploadedFiles}
        imageDataList={props.imageDataList}
        onRemove={(index) => {
          props.setUploadedFiles?.(props.uploadedFiles.filter((_, i) => i !== index));
          props.setImageDataList?.(props.imageDataList.filter((_, i) => i !== index));
        }}
      />
      <ClientOnly>
        {() => (
          <ScreenshotStateManager
            setUploadedFiles={props.setUploadedFiles}
            setImageDataList={props.setImageDataList}
            uploadedFiles={props.uploadedFiles}
            imageDataList={props.imageDataList}
          />
        )}
      </ClientOnly>
      {props.selectedElement && (
        <div className="flex mx-1.5 gap-2 items-center justify-between rounded-lg rounded-b-none border border-b-none border-bolt-elements-borderColor text-bolt-elements-textPrimary flex py-1 px-2.5 font-medium text-xs">
          <div className="flex gap-2 items-center lowercase">
            <code className="bg-hype-accent rounded-[var(--hype-radius-sm)] px-1.5 py-1 mr-0.5 text-hype-on-accent">
              {props?.selectedElement?.tagName}
            </code>
            selected for inspection
          </div>
          <button
            className="bg-transparent text-hype-accent-text pointer-auto"
            onClick={() => props.setSelectedElement?.(null)}
          >
            Clear
          </button>
        </div>
      )}
      <div className="relative">
        <textarea
          id="composer"
          ref={props.textareaRef}
          className={classNames(
            'w-full resize-none bg-transparent px-3 pt-3 text-sm text-bolt-elements-textPrimary outline-none placeholder-bolt-elements-textTertiary',
            'transition-all duration-200',
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid var(--hype-accent)';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid var(--hype-accent)';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '1px solid var(--hype-border)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '1px solid var(--hype-border)';

            const files = Array.from(e.dataTransfer.files);
            files.forEach((file) => {
              if (file.type.startsWith('image/')) {
                const reader = new FileReader();

                reader.onload = (e) => {
                  const base64Image = e.target?.result as string;
                  props.setUploadedFiles?.([...props.uploadedFiles, file]);
                  props.setImageDataList?.([...props.imageDataList, base64Image]);
                };
                reader.readAsDataURL(file);
              }
            });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (event.shiftKey) {
                return;
              }

              event.preventDefault();

              if (props.isStreaming) {
                props.handleStop?.();
                return;
              }

              // ignore if using input method engine
              if (event.nativeEvent.isComposing) {
                return;
              }

              props.handleSendMessage?.(event);
            }
          }}
          value={props.input}
          onChange={(event) => {
            props.handleInputChange?.(event);
          }}
          onPaste={props.handlePaste}
          style={{
            minHeight: props.TEXTAREA_MIN_HEIGHT,
            maxHeight: props.TEXTAREA_MAX_HEIGHT,
          }}
          aria-label={props.chatMode === 'build' ? 'Describe your app' : 'Discuss with the model'}
          placeholder={
            props.chatMode === 'build'
              ? 'Describe your app, e.g. a habit tracker with streaks and dark mode'
              : 'What would you like to discuss?'
          }
          translate="no"
        />
        <div className="flex items-center gap-1.5 pt-1">
          <ClientOnly>
            {() => (
              <AttachmentMenu
                onAttachFile={() => props.handleFileUpload()}
                onOpenDesignDialog={() => {
                  const designButton = document.querySelector('[title="Design Palette"]') as HTMLButtonElement;
                  designButton?.click();
                }}
                onEnhancePrompt={() => {
                  props.enhancePrompt?.();
                }}
                connectors={connectors}
                onConnectorEnabledChange={setConnectorEnabled}
                onOpenMcpTools={() => setIsMcpToolsOpen(true)}
                mcpToolsInitialized={mcpToolsInitialized}
                webSearchEnabled={mcpSettings.webSearchEnabled}
                onWebSearchEnabledChange={setWebSearchEnabled}
                enhancingPrompt={props.enhancingPrompt}
                isEnhanceDisabled={props.input.length === 0 || props.enhancingPrompt}
                isListening={props.isListening}
                onToggleListening={() => {
                  if (props.isListening) {
                    props.stopListening();
                  } else {
                    props.startListening();
                  }
                }}
                micDisabled={props.isStreaming}
                chatMode={props.chatMode}
                agentMode={props.agentMode}
                setChatMode={props.setChatMode}
                setAgentMode={props.setAgentMode}
              />
            )}
          </ClientOnly>
          <div className="hidden">
            <ColorSchemeDialog designScheme={props.designScheme} setDesignScheme={props.setDesignScheme} />
            <SupabaseConnection />
          </div>
          <McpTools open={isMcpToolsOpen} onOpenChange={setIsMcpToolsOpen} />
          <PlanFirstChip chatMode={props.chatMode} />
          <ClientOnly>
            {() => (
              <ModelKeyPopover
                open={modelKeyOpen}
                onOpenChange={setModelKeyOpen}
                provider={props.provider}
                providerList={props.providerList}
                model={props.model}
                modelList={props.modelList}
                apiKeys={props.apiKeys}
                isModelLoading={props.isModelLoading}
                setProvider={props.setProvider}
                setModel={props.setModel}
                onApiKeysChange={props.onApiKeysChange}
              />
            )}
          </ClientOnly>
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            {!props.chatStarted && props.model ? (
              <PlanEstimateChip model={props.model} provider={props.provider?.name} input={props.input} />
            ) : null}
            <ClientOnly>
              {() => (
                <SendButton
                  isStreaming={props.isStreaming}
                  armed={canSend}
                  disabled={(!canSend && !props.isStreaming) || !props.providerList || props.providerList.length === 0}
                  onClick={(event) => {
                    if (props.isStreaming) {
                      props.handleStop?.();
                      return;
                    }

                    if (canSend) {
                      props.handleSendMessage?.(event);
                    }
                  }}
                />
              )}
            </ClientOnly>
          </div>
          <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />
        </div>
      </div>
    </div>
  );
};

function PlanEstimateChip({ model, provider, input }: { model: string; provider?: string; input: string }) {
  const estimate = estimateRequestCost({
    model,
    provider,
    contextText: input || 'Plan a small web app with a few pages, data, and features.',
    completionHint: 'A structured plan with pages, data, features, and a cost range.',
  });

  const amount = estimate.unknown ? 'set a price' : formatDollars(estimate.dollars, 2);

  return (
    <Chip tone="default" disabled className="whitespace-nowrap">
      <span className="sm:hidden">{amount}</span>
      <span className="hidden sm:inline">
        {estimate.unknown ? 'set a price to estimate' : `about ${amount} to plan`}
      </span>
    </Chip>
  );
}
