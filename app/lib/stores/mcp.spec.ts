import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEmptyMcpConfig, pushMcpConfigToServer } from './mcp';

describe('isEmptyMcpConfig', () => {
  it('treats the onboarding default as empty', () => {
    expect(isEmptyMcpConfig({ mcpServers: {} })).toBe(true);
    expect(isEmptyMcpConfig(undefined)).toBe(true);
    expect(isEmptyMcpConfig(null)).toBe(true);
  });

  it('is false when a server is configured', () => {
    expect(
      isEmptyMcpConfig({
        mcpServers: { deepwiki: { type: 'streamable-http', url: 'https://mcp.deepwiki.com/mcp' } },
      }),
    ).toBe(false);
  });
});

describe('pushMcpConfigToServer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fetch when mcpServers is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(pushMcpConfigToServer({ mcpServers: {} })).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs a non-empty config', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ deepwiki: { status: 'available' } }));
    vi.stubGlobal('fetch', fetchMock);

    const config = {
      mcpServers: { deepwiki: { type: 'streamable-http' as const, url: 'https://mcp.deepwiki.com/mcp' } },
    };

    await expect(pushMcpConfigToServer(config)).resolves.toEqual({ deepwiki: { status: 'available' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/mcp-update-config');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(config);
  });

  it('turns a network failure into a reachable error (not a raw Failed to fetch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      pushMcpConfigToServer({
        mcpServers: { deepwiki: { type: 'streamable-http', url: 'https://mcp.deepwiki.com/mcp' } },
      }),
    ).rejects.toThrow(/Could not reach the MCP config endpoint/);
  });
});
