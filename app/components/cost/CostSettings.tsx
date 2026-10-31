import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';
import { TextLink } from '~/components/ui/TextLink';
import { PROVIDER_SPENDING_LIMITS } from '~/lib/cost/limits';
import { costStore, setCostCaps, setCustomModelPrice } from '~/lib/stores/cost';
import { classNames } from '~/utils/classNames';

export function CostSettings() {
  const snapshot = useStore(costStore);
  const [modelId, setModelId] = useState('');
  const [inputPrice, setInputPrice] = useState('');
  const [outputPrice, setOutputPrice] = useState('');

  const saveCap = (kind: 'session' | 'daily', raw: string) => {
    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Cap must be 0 or a positive dollar amount');
      return;
    }

    setCostCaps({ [kind]: parsed });
  };

  const saveCustomPrice = () => {
    const id = modelId.trim();
    const input = Number(inputPrice);
    const output = Number(outputPrice);

    if (!id) {
      toast.error('Enter a model id');
      return;
    }

    if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) {
      toast.error('Prices must be dollars per 1M tokens');
      return;
    }

    setCustomModelPrice(id, { input, output });
    setModelId('');
    setInputPrice('');
    setOutputPrice('');
    toast.success(`Saved price for ${id}`);
  };

  const inputClass = classNames(
    'w-full px-3 py-2 rounded-lg text-sm tabular-nums',
    'bg-bolt-elements-background-depth-2',
    'border border-bolt-elements-borderColor',
    'text-bolt-elements-textPrimary',
    'focus:outline-none focus:ring-2 focus:ring-accent-500/30',
  );

  return (
    <section aria-labelledby="cost-caps-heading" className="space-y-4">
      <div>
        <h2 id="cost-caps-heading" className="mb-1 text-sm font-medium text-bolt-elements-textPrimary">
          Spending caps
        </h2>
        <p className="text-xs leading-5 text-bolt-elements-textSecondary">
          Caps are enforced in this browser, which is your own wallet. Provider-side spending limits are the real
          backstop.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-bolt-elements-textSecondary">
          Session cap (USD, 0 = off)
          <input
            className={classNames(inputClass, 'mt-1')}
            type="number"
            min="0"
            step="0.5"
            defaultValue={snapshot.caps.session}
            onBlur={(event) => saveCap('session', event.target.value)}
          />
        </label>
        <label className="block text-sm text-bolt-elements-textSecondary">
          Daily cap (USD, 0 = off)
          <input
            className={classNames(inputClass, 'mt-1')}
            type="number"
            min="0"
            step="0.5"
            defaultValue={snapshot.caps.daily}
            onBlur={(event) => saveCap('daily', event.target.value)}
          />
        </label>
      </div>

      <p className="flex flex-wrap gap-x-1 gap-y-1 text-xs text-bolt-elements-textTertiary">
        <span>Provider limits:</span>
        {PROVIDER_SPENDING_LIMITS.map((provider) => (
          <TextLink key={provider.href} href={provider.href} external>
            {provider.name}
          </TextLink>
        ))}
      </p>

      <div>
        <h3 className="mb-2 text-sm font-medium text-bolt-elements-textPrimary">Custom model prices</h3>
        <p className="mb-3 text-xs text-bolt-elements-textSecondary">
          Dollars per 1M tokens. Used when we do not know a list price, or to override one.
        </p>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_auto]">
          <input
            className={inputClass}
            placeholder="model id"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
          />
          <input
            className={inputClass}
            placeholder="input"
            type="number"
            min="0"
            step="0.01"
            value={inputPrice}
            onChange={(event) => setInputPrice(event.target.value)}
          />
          <input
            className={inputClass}
            placeholder="output"
            type="number"
            min="0"
            step="0.01"
            value={outputPrice}
            onChange={(event) => setOutputPrice(event.target.value)}
          />
          <Button type="button" variant="primary" onClick={saveCustomPrice}>
            Save
          </Button>
        </div>
        {Object.keys(snapshot.customPrices).length > 0 && (
          <ul className="mt-3 space-y-1">
            {Object.entries(snapshot.customPrices).map(([model, price]) => (
              <li key={model} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-bolt-elements-textSecondary">
                  {model} · ${price.input} / ${price.output} per 1M
                </span>
                <button
                  type="button"
                  className="bg-transparent text-hype-danger hover:underline"
                  onClick={() => setCustomModelPrice(model, null)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
