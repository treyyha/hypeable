import WithTooltip from '~/components/ui/Tooltip';
import { formatSpend } from '~/lib/cost/calc';
import { classNames } from '~/utils/classNames';

export function CostAmount({
  dollars,
  verified = true,
  approximate,
  digits = 3,
  className,
  reason,
}: {
  dollars: number;
  verified?: boolean;
  approximate?: boolean;
  digits?: number;
  className?: string;
  reason?: string;
}) {
  const isApprox = approximate === true || verified === false;
  const tooltip = reason ?? (verified === false ? 'price unverified' : isApprox ? 'estimate' : undefined);

  const amount = (
    <span className={classNames('tabular-nums', className)} title={tooltip}>
      {formatSpend(dollars, { verified, approximate: isApprox, digits })}
    </span>
  );

  if (isApprox) {
    return <WithTooltip tooltip={tooltip ?? 'estimate'}>{amount}</WithTooltip>;
  }

  return amount;
}
