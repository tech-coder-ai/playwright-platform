# Playwright Testing Platform

LLM-powered Playwright testing platform with standard Angular frontend and NestJS backend.

## Structure

```
web/            Angular 19 UI
api/            NestJS REST API + Prisma
shared-types/   Shared TypeScript interfaces
codegen-engine/ Prompt templates + OpenAI API client
tests/            Playwright specs, features, helpers
```

See [PLAN.md](./PLAN.md) for the full build roadmap and [CONVENTIONS.md](./CONVENTIONS.md) for coding standards.

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
# Install all workspace dependencies
npm install

# Install Playwright browser (one-time)
npm run test:playwright:install

# Build shared types
npm run build:shared-types

# Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate
```

Copy `api/.env.example` to `api/.env` if starting fresh (`.env` is gitignored). Set `OPENAI_API_KEY` for LLM test generation.

## Development

```bash
# Terminal 1 — API (port 3000)
npm run start:api

# Terminal 2 — Angular (port 4200, proxies /api → backend)
npm run start:web
```

Open http://localhost:4200

## Running tests manually

1. Create a project, suite, and test case in the UI
2. Set the test case **file path** to `example.spec.ts` (see `tests/example.spec.ts`)
3. Open the suite → **Run suite**
4. View live results, logs, and artifacts on the run detail page

Without an environment selected, runs use `https://example.com` as the base URL. Bind an environment to target a specific app URL. Project secrets are injected as environment variables during runs.

```bash
# Run example specs directly (optional)
npm run test:playwright
```

## LLM test generation

1. Open a project → **Record test**
2. Record interactions, then click **Generate with LLM**
3. Review/edit the feature file, step definitions, and page object side-by-side with the raw recording
4. Select a target suite and click **Save approved tests** (nothing is saved until you approve)

Test prompt templates independently:

```bash
OPENAI_API_KEY=sk-... npm run prompt:test
```

## Page object recorder

Record a single screen and generate a Playwright page object class (new or patch an existing one).

1. Open a project → **Page objects**
2. Click **Record new screen** (or **Re-record** on an existing page object)
3. Enter the start URL and optional screen name, then record interactions
4. Click **Generate page object** to produce a TypeScript class from the recording
5. Review the diff, edit if needed, then **Save** (creates v1) or **Patch** (increments version on re-record)

Saved page objects are written under `tests/page-objects/` and tracked in the database with version history.

## Schedule failure notifications

When creating a schedule, configure **Failure notifications**:

- **Slack** — paste an incoming webhook URL; failures post a summary with a link to the run
- **Email** — comma-separated recipients (requires SMTP settings in `api/.env`)

Notifications fire when a scheduled run (cron or Run now) finishes with failures.

## Authentication & RBAC

Auth is **disabled by default** for local development. To enable:

```bash
# api/.env
AUTH_ENABLED=true
JWT_SECRET=your-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-password
```

On first startup with auth enabled, the admin account is bootstrapped from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

| Role | Access |
|------|--------|
| **viewer** | Read-only (GET) |
| **editor** | Create/update runs, projects, suites, schedules, etc. |
| **admin** | Full access + user management (`/users`) |

Sign in at http://localhost:4200/login when auth is enabled.

## Database & browser configuration

The platform supports restricted environments where Prisma, SQLite, or `playwright install` may not be allowed. Configure via `api/.env`:

### Database (`DB_PROVIDER`)

| Value | When to use | Setup |
|-------|-------------|--------|
| `prisma` (default) | Local dev, SQLite allowed | `npm run db:generate && npm run db:migrate` |
| `json` | No SQL / no Prisma | `DB_PROVIDER=json` and optional `JSON_DB_PATH=../data/platform.json` |
| `oracle` | Enterprise Oracle DB | `DB_PROVIDER=oracle`, Oracle credentials, run `api/database/oracle/schema.sql`, `npm install oracledb --workspace=api` |

Prisma is only required when `DB_PROVIDER=prisma`. JSON and Oracle modes use the same API layer without Prisma at runtime.

### Browser (`BROWSER_PROVIDER`)

| Value | When to use | Setup |
|-------|-------------|--------|
| `playwright` (default) | Standard Playwright install | `npm run test:playwright:install` |
| `npm` | `playwright install` blocked | `BROWSER_PROVIDER=npm`, `npm run test:chromium:install` (or set `CHROMIUM_EXECUTABLE_PATH`) |

Playwright test execution stays the same; only the Chromium binary source changes. The npm `chromium` package path is passed via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## API Health Check

```bash
curl http://localhost:3000/api/health
```
