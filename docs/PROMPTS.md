# Hypeable: paste-in prompts for Cursor

How to use: open the `hypeable` folder in Cursor, open Agent chat, paste ONE prompt at a time, review the diff, then run `npm run ship`.
Always start a new chat per prompt (keeps context clean and cheap).

---
## PROMPT 0: orient (paste first)
```
Read AGENTS.md, SECURITY.md and docs/SECURITY.md fully. This repo is Hypeable, a fork of bolt.diy.
Follow AGENTS.md strictly. Never write real secrets into files. Explore the codebase and write a 15-line summary of:
where the chat/LLM call happens, where API keys are stored client-side, where the UI header lives, and which server routes exist.
Do not change any code yet.
```

## PROMPT 1: rebrand (day 1)
```
Rebrand this app from bolt.diy to "Hypeable" with tagline "worth the hype".
- Replace names, titles, meta tags, README mentions in the UI (NOT the LICENSE or NOTICE.md; those must keep upstream credit).
- Use an ORIGINAL simple wordmark and colour scheme. Do not imitate Lovable, Bolt or any other product (no heart, no similar gradient).
- Add footer text: "Not affiliated with Lovable, Bolt, or StackBlitz."
- IMPORTANT: do not remove or alter the Cross-Origin-Embedder-Policy / Cross-Origin-Opener-Policy headers; WebContainers need them.
Run typecheck and lint. Commit as: feat(brand): rebrand to Hypeable
```

## PROMPT 2: key handling audit (day 1)
```
Audit how API keys flow in this app. Goal: the user's key stays in their browser and is only sent to their chosen model provider.
1. List every place a key is read, stored, logged or sent.
2. Make sure no server code persists or logs a key. Add templates/security/redact.ts as app/lib/security/redact.ts and use it wherever errors or requests are logged.
3. Remove any hardcoded or default keys and any key placed in client bundles via env (nothing secret may use a PUBLIC_/VITE_ prefix).
4. Add a short "Your key" explainer in settings: stays in your browser, never stored by Hypeable.
Commit as: security(keys): redact logs and document BYO key flow
```

## PROMPT 3: security baseline for server routes (day 2)
```
Copy templates/security/* into app/lib/security/ (skip vercel.json) and wire them into every server route (loader/action/API):
- validate.ts: define a zod .strict() schema per route; reject unknown fields. Never accept userId/role/plan/price from the client.
- rate-limit.ts: apply enforceRateLimit to every /api route (chat: 20/min per IP; others 60/min).
- assertSameOrigin on every state-changing request.
- require-auth.ts only where a route needs a user (add later when accounts exist). If there are no accounts yet, say so and skip.
Add vitest tests for: rejects extra fields, rejects bad origin, returns 429 after the limit.
Commit as: security(api): validate input, rate limit, origin check
```

## PROMPT 4: live cost meter (day 2-3)
```
Build the live cost meter, the core feature.
- A model price table (per 1M input/output tokens) in app/lib/cost/prices.ts with a comment of the date prices were checked and a link to each provider's pricing page. Prices must be easy to edit.
- Count tokens from provider usage fields when available; otherwise estimate.
- Show a running dollar total in the header for the current session, with a tooltip breakdown (input, output, per model).
- Settings: session cap and daily cap in dollars. At 80% show a warning; at 100% HARD STOP all requests until the user raises the cap.
- Store the totals locally only (no server).
- Unit tests for the math and cap logic.
Commit as: feat(cost): live dollar meter with session and daily caps
```

## PROMPT 5: loop breaker (day 4)
```
Add a loop breaker. Detect when the agent hits the same or near-identical error 3 times in a row (normalise stack traces / file paths before comparing).
When triggered: stop the run, and show a panel with 3 buttons: "Replan", "Revert last changes", "Switch model".
Show the dollars wasted in the loop (from the cost meter). Add tests for detection.
Commit as: feat(loop): stop repeated-error loops and offer recovery
```

## PROMPT 6: plan-first mode (day 5)
```
Add plan-first mode (default ON). Before writing any code the model returns a short plan: pages, data, features, estimated cost range from the cost meter.
The user can edit and approve it. Only after approval does the build start. Keep the approved plan visible and linked to the commit log.
Commit as: feat(plan): plan-first mode with cost estimate
```

## PROMPT 7: pre-deploy security check (day 6)
```
Before publishing a generated app, run a scanner over its files and show a report (pass/warn/fail):
- secrets (reuse patterns from scripts/secret-scan.mjs), keys in client code or in VITE_/NEXT_PUBLIC_ env
- database access rules missing (e.g. Supabase tables without RLS, open Firebase rules)
- CORS set to *, debug flags on, dependencies with known critical issues if cheap to check
Block "Publish" on any FAIL unless the user ticks "I understand the risk". Add tests with fixture projects.
Commit as: feat(predeploy): security scanner before publish
```

## PROMPT 8: publish to the user's own Vercel/GitHub (day 7)
```
Make sure publish goes to the USER's own accounts using their own token/OAuth, stored only in their browser.
Hypeable must host nothing. Remove or disable any code path that deploys to a Hypeable-owned account.
Commit as: feat(publish): deploy to user-owned Vercel and GitHub only
```

## PROMPT 9: docs pass (day 9)
```
Update README.md, docs/ARCHITECTURE.md and docs/ROADMAP.md to match what exists now. Add a "How the cost meter works" and "How the loop breaker works" doc with diagrams in mermaid.
Add short header comments to new modules. Check every link. Commit as: docs: describe cost meter, loop breaker, plan mode
```

## PROMPT 10: pre-launch security review (day 10)
```
Act as a security reviewer. Check the whole repo against docs/SECURITY.md's threat model table.
Report any: secret in code or history, route missing auth/validation/rate limit, cookie missing HttpOnly/Secure/SameSite, user-controlled identity fields, missing security headers (but never break COOP/COEP).
Fix what is safe; list the rest in docs/KNOWN-ISSUES.md. Commit as: security: pre-launch review fixes
```
