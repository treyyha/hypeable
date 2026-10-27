import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartInSixty } from './StartInSixty';
import { FIRST_RUN_DISMISSED_KEY } from './first-run';

vi.mock('~/lib/openrouter/connect', () => ({
  startOpenRouterConnect: vi.fn(() => Promise.resolve()),
}));

vi.mock('~/lib/performance/prefetch-home', () => ({
  requestProviderListLoad: vi.fn(),
}));

vi.mock('~/lib/stores/loop', () => ({
  openModelPicker: vi.fn(),
}));

describe('StartInSixty', () => {
  afterEach(() => {
    localStorage.removeItem(FIRST_RUN_DISMISSED_KEY);
    delete document.documentElement.dataset.firstRun;
  });

  it('renders the first-run steps in the document', () => {
    render(<StartInSixty />);

    expect(screen.getByRole('heading', { name: 'Start in 60 seconds' })).toBeTruthy();
    expect(screen.getByTestId('connect-openrouter')).toBeTruthy();
    expect(screen.getByTestId('already-have-key')).toBeTruthy();
  });

  it('dismisses into localStorage without a dialog', async () => {
    const user = userEvent.setup();
    render(<StartInSixty />);

    await user.click(screen.getByTestId('dismiss-start-in-sixty'));

    expect(screen.queryByTestId('start-in-sixty')).toBeNull();
    expect(localStorage.getItem(FIRST_RUN_DISMISSED_KEY)).toBe('true');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('hides after hydration when a key already exists', async () => {
    const { rerender } = render(<StartInSixty hasKeys={false} />);
    expect(screen.getByTestId('start-in-sixty')).toBeTruthy();

    rerender(<StartInSixty hasKeys={true} />);
    await waitFor(() => {
      expect(screen.queryByTestId('start-in-sixty')).toBeNull();
    });
  });
});
