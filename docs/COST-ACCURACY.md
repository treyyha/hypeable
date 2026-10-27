# Cost meter accuracy

The header pill is an **estimate** until this file has published comparison rows: tokens × list price from `app/lib/cost/prices.json`, or a provider-reported cost when the provider sends one (OpenRouter `usage.cost`). It is not an invoice.

**Cost meter accuracy has not yet been independently verified against provider billing; results will be published in this file.**

Until that table has rows, treat every dollar figure in the UI as an estimate and set a limit on your provider too.

How the number is produced, when it is exact, and when it is ≈: [COST-METER.md](COST-METER.md).

## Export for a real-key test

On **Spend** (`/spend`), after a few calls:

1. **Copy usage JSON** — one object per model call.
2. **Download CSV** — the same rows.

Each row is: timestamp, provider, model, input / output / cache-read / cache-write / reasoning / image tokens, our computed cost, provider-reported cost if any, exact-or-estimate flag.

The export contains **no** API keys, prompts, or file contents. Chat names are omitted on purpose.

## Method

Compare Hypeable's export to the provider's own usage page.

1. Use the **cheapest** model the provider lists that Hypeable already prices (`verified: true` in `prices.json`).
2. Use a **fixed prompt** (same text every run; no tools, no plan-first, no image, no enhancer).
3. Run **3** times. After each run, copy the latest Spend export row and the matching line on the provider usage page.
4. Do not change caps, custom prices, or the model between runs.
5. Prefer a provider that shows **per-generation** cost (OpenRouter generation cost, OpenAI usage export). If the usage page only shows daily aggregates, run the three prompts in an otherwise idle project and use the delta.

Record the provider, model id, prompt, date, and who ran it. Do not paste API keys or usage-page URLs that contain tokens.

For OpenRouter, treat `provider_cost` in the export as the billed number and `computed_cost` as our table. A difference is expected if the router picked a different underlying price than `prices.json`.

## Results

| Date | Provider | Model | Prompt | Run | Pill (USD) | Export computed | Export provider | Provider usage (USD) | Delta | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | 1 | | | | | | |
| | | | | 2 | | | | | | |
| | | | | 3 | | | | | | |
