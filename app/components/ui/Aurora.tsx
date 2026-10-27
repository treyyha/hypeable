/**
 * Soft CSS-only atmosphere. Use behind the empty home column and empty states only.
 *
 * SVG feTurbulence grain is a full-viewport `background-image: url()`, which
 * Lighthouse treats as the LCP element. Mount it after paint and only on
 * wide screens so the hero heading can be LCP on a phone.
 */
import { useEffect, useState, type HTMLAttributes } from 'react';
import { classNames } from '~/utils/classNames';

type AuroraProps = HTMLAttributes<HTMLDivElement>;

const WIDE_SCREEN = '(min-width: 1024px)';

export function Aurora({ className, ...rest }: AuroraProps) {
  const [showGrain, setShowGrain] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(WIDE_SCREEN);

    if (!media.matches) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => setShowGrain(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={classNames('hype-aurora', className)} aria-hidden="true" {...rest}>
      <div className="hype-aurora__layer" />
      {showGrain ? <div className="hype-aurora__grain" /> : null}
    </div>
  );
}
