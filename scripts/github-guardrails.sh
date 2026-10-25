#!/usr/bin/env bash
# Usage: bash scripts/github-guardrails.sh owner/repo   (requires: gh auth login)
set -euo pipefail
REPO="${1:?usage: github-guardrails.sh owner/repo}"
echo "Enabling secret scanning + push protection + dependabot on $REPO"
gh api -X PATCH "repos/$REPO" --input - <<JSON
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}
JSON
gh api -X PUT "repos/$REPO/vulnerability-alerts" || true
gh api -X PUT "repos/$REPO/automated-security-fixes" || true
echo "Done. (Secret scanning is free on public repos. Branch protection: add in Settings -> Rules once CI has run once.)"
