import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/stores/predeploy', () => ({
  requestPredeployClearance: vi.fn(),
}));

import { withPredeployScan, withPredeployScanFiles } from './intercept';
import { requestPredeployClearance } from '~/lib/stores/predeploy';

const ENTRY_POINTS = [
  'app/components/deploy/DeployButton.tsx',
  'app/components/deploy/GitHubDeploymentDialog.tsx',
  'app/components/deploy/GitLabDeploymentDialog.tsx',
  'app/lib/stores/workbench.ts',
];

describe('predeploy intercept', () => {
  beforeEach(() => {
    vi.mocked(requestPredeployClearance).mockReset();
  });

  it('calls the scan from every publish entry point', () => {
    for (const file of ENTRY_POINTS) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toMatch(/withPredeployScan(Files)?\(/);
    }
  });

  it('does not continue when the modal rejects', async () => {
    vi.mocked(requestPredeployClearance).mockResolvedValue(false);

    const proceed = vi.fn(async () => 'deployed');
    const result = await withPredeployScanFiles({ 'src/a.ts': 'export {}' }, proceed);

    expect(requestPredeployClearance).toHaveBeenCalledOnce();
    expect(proceed).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('continues when the scan is allowed', async () => {
    vi.mocked(requestPredeployClearance).mockResolvedValue(true);

    const proceed = vi.fn(async () => 'deployed');

    const result = await withPredeployScan(
      { 'src/a.ts': { type: 'file', content: 'export {}', isBinary: false } },
      proceed,
    );

    expect(proceed).toHaveBeenCalledOnce();
    expect(result).toBe('deployed');
  });
});
