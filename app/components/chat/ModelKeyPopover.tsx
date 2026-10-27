/**
 * Footer chip that opens provider, model, and key controls in a popover
 * so the first-screen composer can stay a single row.
 */
import * as Popover from '@radix-ui/react-popover';
import { APIKeyManager } from './APIKeyManager';
import { ModelSelector } from '~/components/chat/ModelSelector';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { LOCAL_PROVIDERS } from '~/lib/stores/provider-kinds';
import type { ProviderInfo } from '~/types/model';
import { classNames } from '~/utils/classNames';

export function providerNeedsUiKey(name: string | undefined): boolean {
  if (!name) {
    return true;
  }

  return name === 'OpenAILike' || !LOCAL_PROVIDERS.includes(name);
}

function shortModelName(model: string | undefined): string {
  if (!model) {
    return 'model';
  }

  return model.length > 22 ? `${model.slice(0, 19)}…` : model;
}

type ModelKeyPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: ProviderInfo;
  providerList?: ProviderInfo[];
  model?: string;
  modelList: ModelInfo[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  setProvider?: (provider: ProviderInfo) => void;
  setModel?: (model: string) => void;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
};

export function ModelKeyPopover({
  open,
  onOpenChange,
  provider,
  providerList,
  model,
  modelList,
  apiKeys,
  isModelLoading,
  setProvider,
  setModel,
  onApiKeysChange,
}: ModelKeyPopoverProps) {
  const keyReady = !providerNeedsUiKey(provider?.name) || Boolean(provider && apiKeys[provider.name]);
  const label = `${provider?.name ?? 'provider'} . ${shortModelName(model)}`;

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-testid="model-key-chip"
          aria-label={`${label}. Model and key`}
          title={`${label}. Model and key`}
          className="inline-flex max-w-[11.5rem] items-center gap-1.5 rounded-full border border-hype-border bg-hype-surface px-2 py-1 text-xs text-hype-text hover:border-hype-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
        >
          <span
            aria-hidden="true"
            className={classNames('h-1.5 w-1.5 shrink-0 rounded-full', keyReady ? 'bg-hype-ok' : 'bg-hype-danger')}
          />
          <span className="min-w-0 truncate tabular-nums">{label}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label="Model and key"
          className="z-[9999] w-[min(26rem,calc(100vw-1.5rem))] rounded-[var(--hype-radius-lg)] border border-hype-border bg-hype-surface p-3 shadow-[var(--hype-shadow-lg)]"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-hype-muted">Model and key</p>
          <ModelSelector
            key={provider?.name}
            model={model}
            setModel={setModel}
            modelList={modelList}
            provider={provider}
            setProvider={setProvider}
            providerList={providerList || []}
            apiKeys={apiKeys}
            modelLoading={isModelLoading}
          />
          {(providerList || []).length > 0 && provider && providerNeedsUiKey(provider.name) && (
            <APIKeyManager
              provider={provider}
              apiKey={apiKeys[provider.name] || ''}
              setApiKey={(key) => {
                onApiKeysChange(provider.name, key);
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
