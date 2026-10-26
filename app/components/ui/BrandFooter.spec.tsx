import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandFooter } from './BrandFooter';
import { BUILD_COMMIT, BUILD_VERSION, versionLine } from '~/lib/commit';
import { APP_AFFILIATION } from '~/utils/brand';

describe('BrandFooter', () => {
  it('shows the version line and affiliation', () => {
    render(<BrandFooter />);

    expect(screen.getByText(versionLine(BUILD_VERSION, BUILD_COMMIT))).toBeTruthy();
    expect(screen.getByText(APP_AFFILIATION)).toBeTruthy();
  });
});
