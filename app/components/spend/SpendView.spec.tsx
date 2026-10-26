import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpendView } from './SpendView';
import type { LedgerEntry } from '~/lib/cost/ledger';
import { emptySnapshot } from '~/lib/cost/persist';

const noon = new Date('2026-10-26T12:00:00');

describe('SpendView', () => {
  it('shows the designed empty state when nothing has been spent', () => {
    render(<SpendView snapshot={emptySnapshot(noon)} entries={[]} now={noon} />);

    expect(screen.getByText('Nothing spent yet')).toBeTruthy();
    expect(screen.getByText('Your first build will show up here.')).toBeTruthy();
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    expect(screen.getByRole('figure', { name: /Spend over the last 7 days/i })).toBeTruthy();
    expect(screen.queryByText('Habit tracker')).toBeNull();
    expect(screen.getByTestId('prices-checked').textContent).toMatch(/^prices checked /);
  });

  it('renders real totals, per-model rows, and cap badges', () => {
    const snapshot = emptySnapshot(noon);
    snapshot.sessionTotal = 1.6;
    snapshot.dailyTotal = 10;
    snapshot.caps = { session: 2, daily: 10 };
    snapshot.byModel = {
      'gpt-4o-mini': { dollars: 1.6, promptTokens: 8000, completionTokens: 2000, unverified: true },
    };

    const entries: LedgerEntry[] = [
      {
        id: 'b1',
        timestamp: noon.getTime(),
        chatName: 'Habit tracker',
        model: 'gpt-4o-mini',
        provider: 'openai',
        promptTokens: 8000,
        completionTokens: 2000,
        dollars: 1.6,
        verified: false,
      },
    ];

    render(<SpendView snapshot={snapshot} entries={entries} now={noon} />);

    expect(screen.getByText('Habit tracker')).toBeTruthy();
    expect(screen.getByText('gpt-4o-mini')).toBeTruthy();
    expect(screen.getByText('Warning')).toBeTruthy();
    expect(screen.getByText('Reached')).toBeTruthy();
    expect(screen.getAllByText('≈$1.600').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nothing spent yet')).toBeNull();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getAllByText('OA').length).toBeGreaterThan(0);
    expect(screen.getByRole('figure', { name: /Spend over the last 7 days/i })).toBeTruthy();
  });
});
