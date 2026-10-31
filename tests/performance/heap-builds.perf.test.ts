/**
 * 30 minutes of mocked build turns. Samples heap every 30s so a leak shows as
 * a slope, not a single noisy delta. Override with HYPEABLE_HEAP_MINUTES.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chatBodyNear } from '~/lib/.server/api/chat-body-fixture';
import { REQUEST_LIMITS, chatRequestSchema, parseBody } from '~/lib/.server/api/schemas';
import { applyUsage } from '~/lib/cost/apply';
import { emptySnapshot } from '~/lib/cost/persist';
import { emptyLoopState, reduceLoop } from '~/lib/loop/detect';

const MINUTES = Number(process.env.HYPEABLE_HEAP_MINUTES || 30);
const SAMPLE_MS = 30_000;
const TURN_MS = 200;

function heap() {
  const memory = process.memoryUsage();
  return { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal };
}

describe('mocked-build heap', () => {
  it(
    `holds a session for ${MINUTES} minutes and reports heap`,
    async () => {
      const body = chatBodyNear(Math.min(256 * 1024, REQUEST_LIMITS.MAX_CHAT_BODY_BYTES / 8));
      const parsedOnce = JSON.parse(body);

      let loop = emptyLoopState('heap-chat');
      let cost = emptySnapshot(new Date());

      const samples: Array<{ t: number; turns: number; heapUsed: number; rss: number }> = [];
      const started = Date.now();

      let turns = 0;
      let nextSample = 0;

      if (global.gc) {
        global.gc();
      }

      while (Date.now() - started < MINUTES * 60_000) {
        parseBody(chatRequestSchema, parsedOnce, 'chat');
        loop = reduceLoop(loop, {
          type: 'error',
          raw: `TypeError: Cannot read properties of undefined (reading 'map')\n    at App (heap.tsx:${turns % 40}:1)`,
          attemptId: `a-${turns}`,
          sessionTotal: cost.sessionTotal,
        });
        cost = applyUsage(
          cost,
          { id: `u-${turns % 8}`, model: 'gpt-4o-mini', promptTokens: 800, completionTokens: 200 },
          new Date(),
        ).snapshot;
        turns += 1;

        const elapsed = Date.now() - started;

        if (elapsed >= nextSample) {
          if (global.gc) {
            global.gc();
          }

          const memory = heap();
          samples.push({ t: elapsed, turns, heapUsed: memory.heapUsed, rss: memory.rss });
          nextSample += SAMPLE_MS;
        }

        await new Promise((resolve) => setTimeout(resolve, TURN_MS));
      }

      if (global.gc) {
        global.gc();
      }

      const last = heap();
      samples.push({ t: Date.now() - started, turns, heapUsed: last.heapUsed, rss: last.rss });

      const first = samples[0];

      const report = {
        minutes: MINUTES,
        turns,
        samples,
        heapUsedGrowthBytes: last.heapUsed - first.heapUsed,
        rssGrowthBytes: last.rss - first.rss,
      };
      writeFileSync('docs/heap-mocked-builds.json', `${JSON.stringify(report, null, 2)}\n`);
      console.table(
        samples.map((sample) => ({
          min: (sample.t / 60000).toFixed(1),
          turns: sample.turns,
          heapMB: (sample.heapUsed / 1e6).toFixed(1),
          rssMB: (sample.rss / 1e6).toFixed(1),
        })),
      );

      // A real leak grows many MB; GC noise on a 256 KB parse is far smaller.
      expect(report.heapUsedGrowthBytes).toBeLessThan(80 * 1024 * 1024);
    },
    MINUTES * 60_000 + 60_000,
  );
});
