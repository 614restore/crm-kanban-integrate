# CRM Operating System

This is the execution model to keep quality high while growing users and revenue.

## Product North Star

- North star metric: Weekly Active Companies (WAC)
- Revenue metric: Monthly Recurring Revenue (MRR)
- Quality guardrail: Failed quality-gate runs per week (target: 0)
- Reliability guardrail: Mean time to detect regressions (target: < 24h)

## Weekly Cadence

1. Monday:
   - Review WAC, activation, retention, and trial-to-paid conversion.
   - Pick one growth experiment for acquisition and one for activation.
2. Daily:
   - Keep `quality-gate` and `soak-regression` green.
   - Triage any failing run within one business day.
3. Friday:
   - Review experiment outcomes and ship/rollback decisions.
   - Add one test for every production bug fixed that week.

## Release Gates

Every PR should satisfy:

1. `npm run doctor`
2. `npm run test`
3. `npm run test:month`
4. `npm run build`

Lint currently runs in advisory mode until existing baseline lint debt is reduced.

## Incident Playbook

1. Detection:
   - Watch failing `quality-gate`, `soak-regression`, or `e2e-invite` runs.
2. Triage:
   - Reproduce locally.
   - Isolate the smallest failing path.
3. Fix:
   - Apply the minimal patch.
   - Add/adjust focused tests.
4. Verify:
   - Re-run affected tests and build.
   - Merge only after green checks.

## Growth Execution Backlog

- Add product analytics events for signup, invite acceptance, contact creation, appointment creation, invoice paid.
- Build onboarding checklist UI with completion score.
- Add cohort retention dashboard by company signup week.
- Add trial conversion nudges based on incomplete setup milestones.
- Add billing funnel instrumentation for plan view -> checkout start -> checkout success.
