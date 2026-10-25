import WithTooltip from '~/components/ui/Tooltip';
import { formatSpend } from '~/lib/cost/calc';
import { classNames } from '~/utils/classNames';

export function CostAmount({
  dollars,
  verified = true,
  digits = 3,
  className,
}: {
  dollars: number;
  verified?: boolean;
  digits?: number;
  className?: string;
}) {
  const amount = (
    <span className={classNames('tabular-nums', className)} title={verified === false ? 'price unverified' : undefined}>
      {formatSpend(dollars, { verified, digits })}
    </span>
  );

  if (verified === false) {
    return <WithTooltip tooltip="price unverified">{amount}</WithTooltip>;
  }

  return amount;
}
