# Architecture
```
Browser (UI, WebContainer sandbox, BYO key in local storage)
   |  prompt + user's key (HTTPS)
   v
Thin server route (stateless; validates input; rate-limits; never stores the key)
   |
   v
Model provider (user's account)

Publish: browser -> user's GitHub / Vercel via their own OAuth token
```
Key modules (added over the 10-day build): `cost-meter`, `loop-breaker`, `plan-mode`, `predeploy-check`.

- **Cost meter** — live dollar total in the header, session/daily caps, hard stop. See [COST-METER.md](COST-METER.md).
- **Loop breaker** — stop after the same error repeats, then replan / revert / switch model. See [LOOP-BREAKER.md](LOOP-BREAKER.md).
- **Pre-deploy check** — local scan of the generated app before Vercel / Netlify / GitHub / GitLab publish. See [PREDEPLOY-CHECK.md](PREDEPLOY-CHECK.md).
