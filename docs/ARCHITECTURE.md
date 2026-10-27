# Architecture
```
Browser (UI, WebContainer sandbox, BYO key in local storage)
   |  prompt + user's key (HTTPS)
   v
Cloudflare Worker (stateless relay; validates input; rate-limits; we do not store or log the key; observability off)
   |
   v
Model provider (user's account)

Publish: GitHub/GitLab from the browser (CORS); Vercel/Netlify via a one-shot Worker hop, then the user's account.
Cloudflare handles request metadata and sees traffic in transit. After the first build, WebContainer/preview load from StackBlitz-hosted domains (unaudited).
```
Key modules (added over the 10-day build): `cost-meter`, `loop-breaker`, `plan-mode`, `predeploy-check`.

- **Cost meter** — live dollar total in the header, session/daily caps, hard stop. See [COST-METER.md](COST-METER.md).
- **Loop breaker** — stop after the same error repeats, then replan / revert / switch model. See [LOOP-BREAKER.md](LOOP-BREAKER.md).
- **Pre-deploy check** — local scan of the generated app before Vercel / Netlify / GitHub / GitLab publish. See [PREDEPLOY-CHECK.md](PREDEPLOY-CHECK.md).
