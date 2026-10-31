import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlanFirstChip } from './PlanFirstChip';
import { DEFAULT_PLAN_SETTINGS } from '~/lib/plan';
import { planSettingsStore, planStore, setPlanSettings } from '~/lib/stores/plan';

describe('PlanFirstChip', () => {
  beforeEach(() => {
    setPlanSettings({ ...DEFAULT_PLAN_SETTINGS });
    planStore.set({
      pending: null,
      approved: null,
      skipNextTurn: false,
      forceNextTurn: false,
      panelOpen: true,
      lastUserPrompt: '',
    });
  });

  it('shows on when plan mode is on, and toggling turns it off then on', async () => {
    const user = userEvent.setup();
    setPlanSettings({ enabled: true });
    render(<PlanFirstChip chatMode="build" />);

    const onChip = screen.getByRole('button', { name: 'Plan first is on' });
    expect(onChip).toHaveAttribute('aria-pressed', 'true');
    expect(onChip).toHaveTextContent('Plan first');

    await user.click(onChip);

    expect(planSettingsStore.get().enabled).toBe(false);

    const offChip = screen.getByRole('button', { name: 'Plan first is off' });
    expect(offChip).toHaveAttribute('aria-pressed', 'false');

    await user.click(offChip);

    expect(planSettingsStore.get().enabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Plan first is on' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows on first paint when chatMode is omitted', () => {
    render(<PlanFirstChip />);
    expect(screen.getByRole('button', { name: /Plan first/ })).toBeTruthy();
  });

  it('is hidden in discuss mode and while a plan is pending', () => {
    const { rerender } = render(<PlanFirstChip chatMode="discuss" />);
    expect(screen.queryByRole('button', { name: /Plan first/ })).toBeNull();

    planStore.set({
      ...planStore.get(),
      pending: { intro: '', raw: '', plan: null, retries: 0, tickedIds: [], extraFeature: '' },
    });
    rerender(<PlanFirstChip chatMode="build" />);
    expect(screen.queryByRole('button', { name: /Plan first/ })).toBeNull();
  });
});
