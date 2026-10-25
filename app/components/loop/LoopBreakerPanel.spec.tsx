import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoopBreakerPanel } from './LoopBreakerPanel';

describe('LoopBreakerPanel', () => {
  it('renders the normalised error, count, and wasted cost', () => {
    render(
      <LoopBreakerPanel
        displayError={'typeerror: map of undefined\nat PATH:LINE:COL'}
        count={3}
        wastedCost={0.42}
        onReplan={() => undefined}
        onRevert={() => undefined}
        onSwitchModel={() => undefined}
        onKeepGoing={() => undefined}
      />,
    );

    expect(screen.getByText(/failed 3 times/i)).toBeTruthy();
    expect(screen.getByText(/\$0\.420/)).toBeTruthy();
    expect(screen.getByText(/typeerror: map of undefined/i)).toBeTruthy();
  });

  it('calls the matching handler for each button', () => {
    const onReplan = vi.fn();
    const onRevert = vi.fn();
    const onSwitchModel = vi.fn();
    const onKeepGoing = vi.fn();

    render(
      <LoopBreakerPanel
        displayError="boom"
        count={3}
        wastedCost={0.1}
        onReplan={onReplan}
        onRevert={onRevert}
        onSwitchModel={onSwitchModel}
        onKeepGoing={onKeepGoing}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));

    expect(onReplan).toHaveBeenCalledTimes(1);
    expect(onRevert).toHaveBeenCalledTimes(1);
    expect(onSwitchModel).toHaveBeenCalledTimes(1);
    expect(onKeepGoing).toHaveBeenCalledTimes(1);
  });
});
