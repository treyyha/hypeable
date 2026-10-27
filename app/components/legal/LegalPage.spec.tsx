import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LegalPage } from './LegalPage';

describe('LegalPage', () => {
  it('renders the title and crumb', () => {
    render(
      <LegalPage crumb="privacy" title="Privacy">
        <p>Nothing on a Hypeable server.</p>
      </LegalPage>,
    );

    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeTruthy();
    expect(screen.getByText('privacy')).toBeTruthy();
    expect(screen.getByText('Nothing on a Hypeable server.')).toBeTruthy();
  });
});
