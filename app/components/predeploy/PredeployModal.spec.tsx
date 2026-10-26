import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PredeployModal } from './PredeployModal';
import { cleanFixture, corsWildcardFixture, secretLeakFixture } from '~/lib/predeploy/fixtures';
import { scan } from '~/lib/predeploy/scan';
import { predeployUiStore, resetPredeployGate } from '~/lib/stores/predeploy';

function open(files: Record<string, string>) {
  const report = scan(files);
  predeployUiStore.set({
    open: true,
    report,
    acknowledged: false,
    resolve: () => undefined,
  });
}

describe('PredeployModal', () => {
  beforeEach(() => {
    resetPredeployGate();
  });

  it('requires the risk checkbox before FAIL publish anyway is enabled', () => {
    open(secretLeakFixture);
    render(<PredeployModal />);

    expect(screen.getByText('Publish blocked')).toBeTruthy();
    expect(screen.getByTestId('predeploy-risk')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Publish anyway' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('predeploy-risk'));
    expect((screen.getByRole('button', { name: 'Publish anyway' }) as HTMLButtonElement).disabled).toBe(false);
    expect(JSON.stringify(predeployUiStore.get().report)).not.toContain(`sk-ant-${'a'.repeat(24)}`);
  });

  it('lets WARN-only publish anyway without a checkbox', () => {
    open(corsWildcardFixture);
    render(<PredeployModal />);

    expect(screen.getByText('Warnings before publish')).toBeTruthy();
    expect(screen.queryByTestId('predeploy-risk')).toBeNull();
    expect((screen.getByRole('button', { name: 'Publish anyway' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('heuristic, verify')).toBeTruthy();
  });

  it('shows a calm success state when the scan is clean', () => {
    open(cleanFixture);
    render(<PredeployModal />);

    expect(screen.getByText('Ready to publish')).toBeTruthy();
    expect(screen.getByText('Scan is clean. Publish when you are ready.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Publish anyway' })).toBeNull();
  });
});
