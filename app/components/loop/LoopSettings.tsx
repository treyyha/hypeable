import { useStore } from '@nanostores/react';
import { Switch } from '~/components/ui/Switch';
import { MAX_LOOP_THRESHOLD, MIN_LOOP_THRESHOLD } from '~/lib/loop';
import { loopSettingsStore, setLoopSettings } from '~/lib/stores/loop';
import { classNames } from '~/utils/classNames';

export function LoopSettings() {
  const settings = useStore(loopSettingsStore);

  return (
    <section aria-labelledby="loop-breaker-heading" className="space-y-3">
      <div>
        <h2 id="loop-breaker-heading" className="mb-1 text-sm font-medium text-bolt-elements-textPrimary">
          Loop breaker
        </h2>
        <p className="text-xs leading-5 text-bolt-elements-textSecondary">
          Stop the run after the same error repeats. Stored in this browser only — no telemetry.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-bolt-elements-textSecondary">Enabled</span>
        <Switch
          checked={settings.enabled}
          aria-label="Enable loop breaker"
          onCheckedChange={(checked) => setLoopSettings({ enabled: checked })}
        />
      </div>

      <label className="block text-sm text-bolt-elements-textSecondary">
        Repeat threshold ({MIN_LOOP_THRESHOLD}–{MAX_LOOP_THRESHOLD})
        <input
          className={classNames(
            'mt-1 w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm tabular-nums',
            'text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-accent-500/30',
          )}
          type="number"
          min={MIN_LOOP_THRESHOLD}
          max={MAX_LOOP_THRESHOLD}
          step={1}
          value={settings.threshold}
          disabled={!settings.enabled}
          onChange={(event) => setLoopSettings({ threshold: Number(event.target.value) })}
        />
      </label>
    </section>
  );
}
