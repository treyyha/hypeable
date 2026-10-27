import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Aurora } from './Aurora';

describe('Aurora', () => {
  it('does not mount SVG grain on the first paint', () => {
    const { container } = render(<Aurora data-testid="home-aurora" />);

    expect(container.querySelector('.hype-aurora__layer')).not.toBeNull();
    expect(container.querySelector('.hype-aurora__grain')).toBeNull();
  });
});
