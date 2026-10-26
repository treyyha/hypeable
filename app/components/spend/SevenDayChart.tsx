/**
 * Last-seven-local-days spend sparkline. Plain SVG + a visually hidden table.
 */
import { formatSpend } from '~/lib/cost/calc';
import type { DaySpend } from '~/lib/cost/ledger';
import { classNames } from '~/utils/classNames';

type SevenDayChartProps = {
  days: DaySpend[];
};

export function SevenDayChart({ days }: SevenDayChartProps) {
  const peak = Math.max(0, ...days.map((day) => day.dollars));

  const summary = days
    .map((day) => {
      const amount = formatSpend(day.dollars, { verified: !day.unverified, digits: 2 });
      return `${day.label} ${amount}`;
    })
    .join(', ');

  return (
    <figure className="m-0" aria-label={`Spend over the last 7 days: ${summary}`}>
      <svg viewBox="0 0 224 72" className="h-16 w-full text-hype-accent" role="img" aria-hidden="true">
        {days.map((day, index) => {
          const barWidth = 20;
          const gap = 12;
          const x = index * (barWidth + gap) + 4;
          const ratio = peak > 0 ? day.dollars / peak : 0;
          const barHeight = Math.max(day.dollars > 0 ? 4 : 2, ratio * 52);
          const y = 56 - barHeight;

          return (
            <g key={day.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="3"
                className={day.dollars > 0 ? 'fill-current' : 'fill-hype-surface-2'}
              />
              <text
                x={x + barWidth / 2}
                y={70}
                textAnchor="middle"
                className="fill-hype-muted"
                style={{ fontSize: '9px' }}
              >
                {day.label.slice(0, 2)}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Spend over the last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Spend</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{day.label}</th>
              <td className="tabular-nums">{formatSpend(day.dollars, { verified: !day.unverified, digits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className={classNames('mt-1 text-right text-[11px] text-hype-muted', 'tabular-nums')}>
        7-day
      </figcaption>
    </figure>
  );
}
