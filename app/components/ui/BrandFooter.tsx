import { APP_AFFILIATION } from '~/utils/brand';
import { classNames } from '~/utils/classNames';

export function BrandFooter({ className }: { className?: string }) {
  return (
    <p className={classNames('px-4 py-2 text-center text-[11px] leading-4 text-bolt-elements-textTertiary', className)}>
      {APP_AFFILIATION}
    </p>
  );
}
