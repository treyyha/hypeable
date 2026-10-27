# Cost meter accuracy

The header pill is an **estimate**: tokens × list price from `app/lib/cost/prices.json`, or a provider-reported cost when the provider sends one (OpenRouter `usage.cost`). It is not an invoice.

**Cost meter accuracy has not yet been independently verified against provider billing; results will be published in this file.**

Until that table has rows, treat every dollar figure in the UI as an estimate and set a limit on your provider too.

## Method

Compare the Hypeable pill to the provider's own usage page.

1. Use the **cheapest** model the provider lists that Hypeable already prices.
2. Use a **fixed prompt** (same text every run; no tools, no plan-first, no image).
3. Run **3** times. Record pill dollars, provider usage-page dollars, and the delta.
4. Do not change caps, custom prices, or the model between runs.

Record the provider, model id, prompt, date, and who ran it. Do not paste API keys or usage-page URLs that contain tokens.

## Results

| Date | Provider | Model | Prompt | Run | Pill (USD) | Provider usage (USD) | Delta | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | 1 | | | | |
| | | | | 2 | | | | |
| | | | | 3 | | | | |

How the pill is computed: [COST-METER.md](COST-METER.md).
