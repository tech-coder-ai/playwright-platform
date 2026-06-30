# Playwright Testing Platform — Build Plan

Standard Angular + NestJS layout (no Nx/Turborepo).

## Architecture

```
/web              → Angular 19 UI (standard CLI)
/api              → NestJS backend
/shared-types     → TS interfaces shared between web & api
/data             → db.sqlite, secrets.enc
/artifacts        → screenshots, videos, traces, reports
```

Future packages (add when needed):

```
/codegen-engine       → Playwright codegen wrapper + LLM prompt logic
/test-runner          → Spawns/manages Playwright + Cucumber processes
/page-object-recorder → Playwright trace/recorder integration
/test-helpers         → Reusable step-definition helper library
```

## Domain Model (SQLite via Prisma)

- `Project` — top-level grouping
- `TestSuite` — collection of test cases, tags
- `TestCase` — type: `gherkin` | `playwright-native`
- `StepDefinition` — reusable steps library
- `PageObject` — recorded selectors/actions per screen, versioned
- `Secret` — encrypted (AES-256), scoped to project/environment
- `Schedule` — cron expression, target suite(s)
- `TestRun` — execution record
- `TestResult` — per-test-case result within a run
- `Environment` — dev/staging/prod base URLs + secret bindings

## Build Phases

1. **Scaffold** — Angular web, NestJS api, shared-types, Prisma schema *(current)*
2. **CRUD layer** — Projects, Suites, Test Cases, Environments
3. **Secrets module** — encryption utility, secrets CRUD, environment binding *(done)*
4. **Test runner** — manual trigger, capture output/artifacts *(done)*
5. **Dashboards** — pass/fail trends, drill-down to artifacts *(done)*
6. **Scheduler** — cron-based triggering *(done)*
7. **Codegen integration** — wrap `playwright codegen`, stream to UI *(done)*
8. **LLM generation layer** — recordings → feature files/step defs/page objects *(done)*
9. **Page Object Recorder UI** *(done)*
10. **Polish** — flaky test detection, notifications, RBAC *(done)*

## Technical Risks

- Playwright server-side needs headless Chromium (Docker with Playwright base image)
- Concurrent runs need resource limits (start with 2–3 worker pool)
- LLM-generated step defs must compile/lint before save

## Cursor Notes

- Review Prisma schema before UI work — it is the backbone
- Test LLM prompt templates as standalone scripts before wiring to UI
- Build phase-by-phase in focused sessions per module
