/**
 * Tinted chip-button: 10% accent fill, accent text that meets AA in both themes.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

type Shared = {
  className?: string;
  children: ReactNode;
};

type LinkButtonAnchor = Shared &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
    href: string;
    external?: boolean;
  };

type LinkButtonButton = Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'href' | 'type'> & {
    href?: undefined;
    external?: never;
  };

export type LinkButtonProps = LinkButtonAnchor | LinkButtonButton;

export function LinkButton(props: LinkButtonProps) {
  const classes = classNames('hype-link-btn', props.className);

  if (typeof props.href === 'string') {
    const { className: _className, children, href, external, ...rest } = props;

    return (
      <a href={href} className={classes} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} {...rest}>
        {children}
      </a>
    );
  }

  const { className: _className, children, href: _href, external: _external, ...rest } = props;

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
