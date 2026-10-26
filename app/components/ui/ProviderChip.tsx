/**
 * Provider-coloured two-letter chip. Inline SVG-free avatar, no network.
 */
import { providerChipMeta, type ProviderChipTone } from '~/lib/ui/provider-chip';
import { classNames } from '~/utils/classNames';

const TONE_CLASS: Record<ProviderChipTone, string> = {
  lime: 'hype-provider-chip--lime',
  mint: 'hype-provider-chip--mint',
  cyan: 'hype-provider-chip--cyan',
  warn: 'hype-provider-chip--warn',
  muted: 'hype-provider-chip--muted',
};

type ProviderChipProps = {
  provider?: string;
  className?: string;
  size?: 'sm' | 'md';
};

export function ProviderChip({ provider, className, size = 'md' }: ProviderChipProps) {
  const meta = providerChipMeta(provider);

  return (
    <span
      className={classNames(
        'hype-provider-chip inline-flex shrink-0 items-center justify-center font-semibold tabular-nums',
        size === 'sm' ? 'h-5 w-5 rounded-[5px] text-[9px]' : 'h-8 w-8 rounded-[var(--hype-radius-md)] text-[11px]',
        TONE_CLASS[meta.tone],
        className,
      )}
      title={meta.name}
      aria-hidden="true"
    >
      {meta.code}
    </span>
  );
}
