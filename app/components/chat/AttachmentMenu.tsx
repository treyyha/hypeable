import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import type { ConnectorId } from '~/lib/stores/mcp';
import { useToolAccessStore, type ToolAccessMode } from '~/lib/stores/toolAccess';
import { classNames } from '~/utils/classNames';

type ConnectorMenuItem = {
  id: ConnectorId;
  name: string;
  icon: ReactNode;
  enabled: boolean;
};

interface AttachmentMenuProps {
  onAttachFile: () => void;
  connectors: ConnectorMenuItem[];
  onConnectorEnabledChange: (connector: ConnectorId, enabled: boolean) => void;
  onEnhancePrompt: () => void;
  onOpenDesignDialog: () => void;
  onOpenMcpTools: () => void;
  mcpToolsInitialized: boolean;
  webSearchEnabled: boolean;
  onWebSearchEnabledChange: (enabled: boolean) => void;
  enhancingPrompt?: boolean;
  isEnhanceDisabled?: boolean;
  isListening?: boolean;
  onToggleListening?: () => void;
  micDisabled?: boolean;
  chatMode?: 'discuss' | 'build';
  agentMode?: boolean;
  setChatMode?: (mode: 'discuss' | 'build') => void;
  setAgentMode?: (enabled: boolean) => void;
}

const itemClass = classNames(
  'flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer',
  'text-bolt-elements-textPrimary',
  'hover:bg-bolt-elements-background-depth-3',
  'data-[highlighted]:bg-bolt-elements-background-depth-3',
  'outline-none transition-colors',
);

const TOOL_MODES: Array<{ id: ToolAccessMode; label: string; description: string }> = [
  { id: 'ask-for-all', label: 'Ask For All', description: 'Ask before running each tool' },
  { id: 'full-access', label: 'Full Access', description: 'Run tools without asking each time' },
];

export function AttachmentMenu({
  onAttachFile,
  connectors,
  onConnectorEnabledChange,
  onEnhancePrompt,
  onOpenDesignDialog,
  onOpenMcpTools,
  mcpToolsInitialized,
  webSearchEnabled,
  onWebSearchEnabledChange,
  enhancingPrompt = false,
  isEnhanceDisabled = false,
  isListening = false,
  onToggleListening,
  micDisabled = false,
  chatMode,
  agentMode,
  setChatMode,
  setAgentMode,
}: AttachmentMenuProps) {
  const toolMode = useToolAccessStore((state) => state.mode);
  const setToolMode = useToolAccessStore((state) => state.setMode);
  const selectedTool = TOOL_MODES.find((item) => item.id === toolMode) ?? TOOL_MODES[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="Composer options"
          aria-label="Composer options"
          className={classNames(
            'flex items-center appearance-none text-bolt-elements-item-contentDefault bg-transparent',
            'hover:text-bolt-elements-item-contentActive rounded-md p-1',
            'hover:bg-bolt-elements-item-backgroundActive',
            'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus focus:ring-offset-1',
            'transition-all',
          )}
        >
          <div className="i-ph:plus text-xl"></div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={classNames(
            'min-w-[220px] rounded-lg p-1',
            'bg-bolt-elements-background-depth-2',
            'border border-bolt-elements-borderColor',
            'shadow-lg',
            'z-[1000]',
          )}
          sideOffset={5}
          align="start"
        >
          <DropdownMenu.Item className={itemClass} onSelect={onAttachFile}>
            <div className="i-ph:paperclip text-lg"></div>
            <span>Attach File</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(itemClass, micDisabled && 'opacity-50 cursor-not-allowed')}
            onSelect={onToggleListening}
            disabled={micDisabled}
          >
            <div className={isListening ? 'i-ph:microphone-slash text-lg' : 'i-ph:microphone text-lg'} />
            <span>{isListening ? 'Stop listening' : 'Voice input'}</span>
          </DropdownMenu.Item>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={classNames(itemClass, 'justify-between')}>
              <div className="flex items-center gap-2">
                <div className={chatMode === 'discuss' ? 'i-ph:chats text-lg' : 'i-ph:robot text-lg'} />
                <span>{chatMode === 'discuss' ? 'Discuss' : 'Agent mode'}</span>
              </div>
              <div className="i-ph:caret-right text-sm"></div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="z-[1000] min-w-[180px] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-1 shadow-lg"
                sideOffset={8}
              >
                <DropdownMenu.Item
                  className={classNames(
                    itemClass,
                    chatMode === 'build' && agentMode && 'bg-bolt-elements-item-backgroundAccent',
                  )}
                  onSelect={() => {
                    setChatMode?.('build');
                    setAgentMode?.(true);
                  }}
                >
                  <div className="i-ph:robot text-lg" />
                  <span>Agent</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={classNames(itemClass, chatMode === 'discuss' && 'bg-bolt-elements-item-backgroundAccent')}
                  onSelect={() => {
                    setChatMode?.('discuss');
                    setAgentMode?.(false);
                  }}
                >
                  <div className="i-ph:chats text-lg" />
                  <span>Discuss</span>
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={classNames(itemClass, 'justify-between')}>
              <div className="flex items-center gap-2">
                <div className={toolMode === 'full-access' ? 'i-ph:shield-warning text-lg' : 'i-ph:hand text-lg'} />
                <span>{selectedTool.label}</span>
              </div>
              <div className="i-ph:caret-right text-sm"></div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="z-[1000] min-w-[220px] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-1 shadow-lg"
                sideOffset={8}
              >
                {TOOL_MODES.map((item) => (
                  <DropdownMenu.Item
                    key={item.id}
                    className={classNames(
                      itemClass,
                      'items-start',
                      toolMode === item.id && 'bg-bolt-elements-item-backgroundAccent',
                    )}
                    onSelect={() => setToolMode(item.id)}
                  >
                    <div className={item.id === 'full-access' ? 'i-ph:shield-warning text-lg' : 'i-ph:hand text-lg'} />
                    <span className="flex min-w-0 flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs text-bolt-elements-textSecondary">{item.description}</span>
                    </span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="h-px bg-bolt-elements-borderColor my-1" />

          <DropdownMenu.Item className={itemClass} onSelect={onOpenDesignDialog}>
            <div className="i-ph:palette text-lg"></div>
            <span>Design Palette</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(itemClass, isEnhanceDisabled && 'opacity-50 cursor-not-allowed')}
            onSelect={onEnhancePrompt}
            disabled={isEnhanceDisabled}
          >
            {enhancingPrompt ? (
              <div className="i-ph:circle-notch text-bolt-elements-loader-progress text-lg animate-spin"></div>
            ) : (
              <div className="i-bolt:stars text-lg"></div>
            )}
            <span>Enhance Prompt</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(itemClass, !mcpToolsInitialized && 'opacity-50 cursor-not-allowed')}
            onSelect={onOpenMcpTools}
            disabled={!mcpToolsInitialized}
          >
            <div className="i-bolt:mcp text-lg"></div>
            <span>MCP Tools Available</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-bolt-elements-borderColor my-1" />

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={classNames(itemClass, 'justify-between')}>
              <div className="flex items-center gap-2">
                <div className="i-ph:plug text-lg"></div>
                <span>Connectors</span>
              </div>
              <div className="i-ph:caret-right text-sm"></div>
            </DropdownMenu.SubTrigger>

            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className={classNames(
                  'min-w-[180px] rounded-lg p-1',
                  'bg-bolt-elements-background-depth-2',
                  'border border-bolt-elements-borderColor',
                  'shadow-lg',
                  'z-[1000]',
                )}
                sideOffset={8}
              >
                <DropdownMenu.Item
                  onSelect={() => onWebSearchEnabledChange(!webSearchEnabled)}
                  className={classNames(itemClass, 'justify-between')}
                >
                  <div className="i-ph:magnifying-glass text-lg" />
                  <span>Web Search</span>
                  <span
                    aria-label={webSearchEnabled ? 'Enabled' : 'Disabled'}
                    className={classNames(
                      'ml-auto h-2 w-2 rounded-full',
                      webSearchEnabled ? 'bg-green-500' : 'bg-red-500',
                    )}
                  />
                </DropdownMenu.Item>

                {connectors.map((connector) => (
                  <DropdownMenu.Item
                    key={connector.id}
                    className={classNames(itemClass, 'justify-between')}
                    onSelect={() => onConnectorEnabledChange(connector.id, !connector.enabled)}
                  >
                    {connector.icon}
                    <span>{connector.name}</span>
                    <span
                      aria-label={connector.enabled ? 'Enabled' : 'Disabled'}
                      className={classNames(
                        'ml-auto h-2 w-2 rounded-full',
                        connector.enabled ? 'bg-green-500' : 'bg-red-500',
                      )}
                    />
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
