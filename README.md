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

## Recording browsers: local vs remote (server-hosted)

`playwright codegen` opens a browser on the machine running the API — useless once the
platform is deployed on a server. The recorder therefore supports two modes, configured via
`api/.env`:

| `CODEGEN_RECORDER` | Behavior |
|---|---|
| `local` (default) | A headed Chromium window opens on the API machine (original behavior, for laptops) |
| `remote` | Chromium runs **headless on the server** and is streamed into the web UI over CDP screencast; your clicks/keystrokes are forwarded back and recorded server-side |

In remote mode the recorder page shows a live canvas of the server browser. Everything
downstream (live codegen output, LLM generation, review, save) is identical in both modes.
Users can pick the mode per recording session unless `CODEGEN_RECORDER_LOCKED=true` pins the
server default. Tune stream quality with `CODEGEN_STREAM_QUALITY` (JPEG 1–100) and pass extra
Chromium flags (e.g. `--no-sandbox` on hardened Linux hosts) via `CODEGEN_BROWSER_ARGS`.

## Theming

The UI ships with light and dark themes plus a follow-OS mode. Use the toggle in the top bar
(persisted per browser in `localStorage`). All components style against CSS design tokens in
`web/src/styles.scss` — add or rebrand themes by overriding the token block.

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

Playwright test execution stays the same; only the Chromium binary source changes. The npm `chromium` package path is passed via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The remote recorder honors `CHROMIUM_EXECUTABLE_PATH` too.

### Security & deployment

- `CORS_ORIGINS` — comma-separated allowed browser origins for the REST API and websockets (default `http://localhost:4200`).
- `BODY_LIMIT` — max JSON payload size (default `5mb`).
- Baseline security headers are set on every response; shutdown hooks close recording browsers and scheduled jobs cleanly.

## API Health Check

```bash
curl http://localhost:3000/api/health
```
