# Conventions

## Repository Layout

| Path | Purpose |
|------|---------|
| `web/` | Angular frontend — components, services, routes |
| `api/` | NestJS backend — modules mirror domain entities |
| `shared-types/` | Shared TS interfaces; build before api/web when types change |
| `data/` | Local SQLite DB and encrypted secrets (gitignored except `.gitkeep`) |
| `artifacts/` | Test run outputs (gitignored except `.gitkeep`) |

## Naming

- **Files:** kebab-case (`projects.service.ts`, `test-run-card.component.ts`)
- **Classes:** PascalCase (`ProjectsService`, `TestRunCardComponent`)
- **API routes:** plural kebab-case under `/api` prefix (`/api/projects`, `/api/test-runs`)
- **Prisma models:** PascalCase singular (`Project`, `TestRun`)
- **DB columns:** camelCase in Prisma schema

## NestJS Modules

One module per domain entity: `ProjectsModule`, `TestSuitesModule`, etc.

Each module contains:
- `*.controller.ts` — REST endpoints
- `*.service.ts` — Prisma access + business logic
- `*.module.ts` — wiring

Shared infrastructure lives in `api/src/prisma/`.

## Angular Structure

```
web/src/app/
  core/           → singleton services (api client, config)
  shared/         → reusable components/pipes
  features/       → lazy-loaded feature areas (projects, runs, recorder)
  layout/         → shell, nav, sidebar
```

Feature components use standalone components (Angular 19 default).

## API ↔ Frontend

- Dev proxy: Angular `proxy.conf.json` forwards `/api` → `http://localhost:3000`
- Shared DTO shapes live in `shared-types/` — import types, don't duplicate

## Commits

- Imperative mood, concise: `add projects CRUD module`, `fix secret encryption key length check`
- One logical change per commit

## Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | `api/.env` | SQLite path |
| `SECRETS_ENCRYPTION_KEY` | `api/.env` | AES-256 key (32 bytes) |
| `ARTIFACTS_DIR` | `api/.env` | Test artifact storage path |
| `PORT` | `api/.env` | API server port (default 3000) |

Never commit `.env` files or decrypted secrets.

## JSON Array Fields

SQLite lacks native arrays. Store as JSON strings in Prisma (`tags`, `suiteIds`, `artifactPaths`). Parse/stringify in the service layer.
