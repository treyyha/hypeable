import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanCard } from './PlanCard';
import type { HypeablePlan } from '~/lib/plan';

const plan: HypeablePlan = {
  title: '<img src=x onerror="alert(1)">Notes',
  summary: 'Hello <script>alert(1)</script> world',
  pages: [{ name: 'Home', purpose: 'List' }],
  data: [{ entity: 'Note', storage: 'localStorage' }],
  features: [{ id: 'list', text: 'List notes' }],
  stack: ['Vite'],
  assumptions: ['offline'],
  risks: ['quota'],
};

describe('PlanCard', () => {
  it('renders plan HTML as inert text, never as nodes', () => {
    render(
      <PlanCard
        plan={plan}
        intro=""
        raw=""
        tickedIds={['list']}
        extraFeature=""
        retries={0}
        maxRetries={2}
        model="gpt-4o-mini"
        onApprove={() => undefined}
        onApproveAnyway={() => undefined}
        onRetry={() => undefined}
        onAskChanges={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('region', { name: 'Build plan' }).innerHTML).not.toContain('<img');
    expect(screen.getByRole('region', { name: 'Build plan' }).textContent).toContain('Notes');
    expect(screen.getByRole('region', { name: 'Build plan' }).textContent).toContain('Hello alert(1) world');
  });
});
