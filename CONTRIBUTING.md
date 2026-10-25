# Contributing

1. Fork, then `pnpm install && npm run setup` (activates the secret-scan and commit-message hooks).
2. Branch: `feat/<thing>` or `fix/<thing>`.
3. Commit with Conventional Commits, e.g. `feat(meter): add daily cap`.
4. `npm run typecheck && npm run lint && npm test` must pass.
5. Open a PR using the template. Explain the *why*.

## Never commit secrets
Hooks and CI block them. If a real key ever lands in git, rotate it first, then see docs/SECURITY.md "Purging secrets".
