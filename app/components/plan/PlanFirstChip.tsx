/**
 * Composer control for plan-first mode. Selected means the setting is on;
 * clicking toggles the real `planSettings.enabled` flag in both directions.
 */
import { useStore } from '@nanostores/react';
import { Chip } from '~/components/ui/Chip';
import { planSettingsStore, planStore, setPlanSettings } from '~/lib/stores/plan';

type PlanFirstChipProps = {
  chatMode?: 'discuss' | 'build';
};

export function PlanFirstChip({ chatMode }: PlanFirstChipProps) {
  const settings = useStore(planSettingsStore);
  const planUi = useStore(planStore);

  if (chatMode !== 'build' || planUi.pending) {
    return null;
  }

  const on = settings.enabled;

  return (
    <Chip
      selected={on}
      aria-pressed={on}
      aria-label={on ? 'Plan first is on' : 'Plan first is off'}
      title={on ? 'Plan first is on. Click to turn off.' : 'Plan first is off. Click to turn on.'}
      onClick={() => setPlanSettings({ enabled: !on })}
    >
      Plan first
    </Chip>
  );
}
