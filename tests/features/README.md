# Gherkin Feature Files

This directory contains Gherkin `.feature` files that describe the expected behavior of the CRM in plain English.

## Files

| File | Covers |
|------|--------|
| `auth.feature` | Login, logout, role-based access |
| `contacts.feature` | Contact CRUD, company isolation |
| `crew-schedule.feature` | Crew calendar, FK routing, stats |
| `automations.feature` | Automation rules, run history, suggestions |
| `estimates.feature` | Estimate creation, totals, PDF export |
| `build-integrity.feature` | Build success, missing exports, env vars |

## How Scenarios Are Used

- **Nightly CI** (`.github/workflows/nightly.yml`) — runs at 2am ET every night, validates build + parses all feature files
- **PR Checks** (`.github/workflows/pr-checks.yml`) — runs on every PR to `main`, blocks merge if build or Gherkin parse fails
- **Manual** — run `npx @cucumber/cucumber --dry-run 'tests/features/**/*.feature'` locally to validate scenarios

## Adding Step Definitions

When you're ready to wire up full E2E tests, add step definition files to `tests/steps/` and install Playwright or Cypress.
Each Gherkin `Given / When / Then` line maps to a function in those files.

## Branch Strategy

```
main          ← production, protected (requires PR checks to pass)
fix/xxx       ← isolated bug fixes, branch from main
feature/xxx   ← new features, branch from main
nightly/xxx   ← scheduled or automated edit runs
```

Never commit directly to `main` — always open a PR so checks run first.
