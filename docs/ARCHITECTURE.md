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
Each gets a short doc here when it ships.
