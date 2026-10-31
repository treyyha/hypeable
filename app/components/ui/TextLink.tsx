/**
 * Accent text link with no fill. Light theme uses --hype-accent-text (darker lime).
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

type Shared = {
  className?: string;
  children: ReactNode;
};

type TextLinkAnchor = Shared &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
    href: string;
    external?: boolean;
  };

type TextLinkButton = Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'href' | 'type'> & {
    href?: undefined;
    external?: never;
  };

export type TextLinkProps = TextLinkAnchor | TextLinkButton;

export function TextLink(props: TextLinkProps) {
  const classes = classNames('hype-text-link', props.className);

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
