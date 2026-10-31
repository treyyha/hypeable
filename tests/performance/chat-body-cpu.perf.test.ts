/**
 * CPU cost of reading, parsing and validating an /api/chat body before any
 * provider call. That work is billed Worker CPU on every turn, so it bounds
 * the body cap. Numbers are recorded in docs/LIMITS.md.
 */
import { describe, expect, it } from 'vitest';
import { chatBodyNear } from '~/lib/.server/api/chat-body-fixture';
import { readJsonBody } from '~/lib/.server/api/read-body';
import { REQUEST_LIMITS, chatRequestSchema, parseBody } from '~/lib/.server/api/schemas';

const MIB = 1024 * 1024;

/*
 * Windows' cpuUsage ticks every ~15.6 ms, so CPU is averaged over many runs;
 * the wall median is the per-request figure (the work is synchronous).
 */
async function measure(body: string, runs = 40): Promise<{ cpuMs: number; wallMs: number }> {
  const walls: number[] = [];
  const cpuStart = process.cpuUsage();

  for (let i = 0; i < runs; i += 1) {
    const request = new Request('http://localhost/api/chat', { method: 'POST', body });
    const start = performance.now();
    const raw = await readJsonBody(request, { maxBytes: REQUEST_LIMITS.MAX_CHAT_BODY_BYTES });
    parseBody(chatRequestSchema, raw, 'chat');
    walls.push(performance.now() - start);
  }

  const cpu = process.cpuUsage(cpuStart);
  walls.sort((a, b) => a - b);

  return { cpuMs: (cpu.user + cpu.system) / 1000 / runs, wallMs: walls[Math.floor(runs / 2)] };
}

describe('chat body CPU near the cap', () => {
  it('reports median read + parse + validate CPU per size', async () => {
    const rows: Array<{ size: string; cpuMs: number; wallMs: number }> = [];

    for (const target of [0.3 * MIB, 0.5 * MIB, 1 * MIB, 1.5 * MIB, 1.95 * MIB]) {
      const body = chatBodyNear(target);
      const { cpuMs, wallMs } = await measure(body);
      rows.push({
        size: `${(body.length / MIB).toFixed(2)} MiB`,
        cpuMs: Number(cpuMs.toFixed(2)),
        wallMs: Number(wallMs.toFixed(2)),
      });
    }

    console.table(rows);

    // Loose ceiling: this suite is non-blocking, the table is the point.
    expect(rows.at(-1)!.wallMs).toBeLessThan(500);
  });
});
