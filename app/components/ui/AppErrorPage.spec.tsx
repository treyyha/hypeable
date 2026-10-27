import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppErrorPage } from './AppErrorPage';

describe('AppErrorPage', () => {
  it('renders a branded 404', () => {
    render(<AppErrorPage status={404} />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back home' }).getAttribute('href')).toBe('/');
  });

  it('renders a branded error', () => {
    render(<AppErrorPage status={500} />);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
  });
});
