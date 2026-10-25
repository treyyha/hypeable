import { useStore } from '@nanostores/react';
import { Switch } from '~/components/ui/Switch';
import { planSettingsStore, setPlanSettings } from '~/lib/stores/plan';

export function PlanSettings() {
  const settings = useStore(planSettingsStore);

  return (
    <section aria-labelledby="plan-mode-heading" className="space-y-3">
      <div>
        <h2 id="plan-mode-heading" className="mb-1 text-sm font-medium text-bolt-elements-textPrimary">
          Plan-first mode
        </h2>
        <p className="text-xs leading-5 text-bolt-elements-textSecondary">
          Show a plan with a cost estimate before writing code. Stored in this browser only — no telemetry.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-bolt-elements-textSecondary">Plan mode</span>
        <Switch
          checked={settings.enabled}
          aria-label="Enable plan mode"
          onCheckedChange={(checked) => setPlanSettings({ enabled: checked })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-bolt-elements-textSecondary">Plan every request</span>
        <Switch
          checked={settings.everyRequest}
          disabled={!settings.enabled}
          aria-label="Plan every request"
          onCheckedChange={(checked) => setPlanSettings({ everyRequest: checked })}
        />
      </div>
    </section>
  );
}
