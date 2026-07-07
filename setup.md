# Windows setup guide

This guide walks through running the Playwright Testing Platform on a **Windows 10/11** machine from a fresh clone.

For day-to-day usage after setup, see [README.md](./README.md).

---

## 1. Prerequisites

Install the following before cloning the repo:

| Tool | Version | Notes |
|------|---------|--------|
| [Node.js](https://nodejs.org/) | **20 LTS or newer** | Includes npm. Verify with `node -v` and `npm -v`. |
| [Git](https://git-scm.com/download/win) | Latest | Use **Git Bash**, **PowerShell**, or **Windows Terminal**. |
| [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) | Optional | Usually not required; Playwright installer handles most browser deps. |

**Recommended:** [Windows Terminal](https://aka.ms/terminal) with PowerShell 7+.

---

## 2. Clone the repository

```powershell
cd C:\dev
git clone https://github.com/tech-coder-ai/playwright-platform.git
cd playwright-platform
```

Use any folder you prefer instead of `C:\dev`.

---

## 3. Install dependencies

From the repository root:

```powershell
npm install
```

This installs all workspace packages (`web`, `api`, `shared-types`, `codegen-engine`, `tests`).

---

## 4. Install Chromium

Choose **one** browser setup based on what your environment allows.

### Option A — Playwright browser (default)

```powershell
npm run test:playwright:install
```

If the install fails:

```powershell
cd tests
npx playwright install chromium
npx playwright install-deps chromium
cd ..
```

In `api\.env` leave `BROWSER_PROVIDER=playwright` (default).

### Option B — npm `chromium` package (no `playwright install`)

Use this when corporate policy blocks Playwright’s browser download:

```powershell
npm run test:chromium:install
```

In `api\.env`:

```env
BROWSER_PROVIDER=npm
# Optional if auto-detection fails:
# CHROMIUM_EXECUTABLE_PATH=C:\path\to\chromium.exe
```

Test runs and codegen still use Playwright; only the Chromium binary comes from the npm package.

**How the executable is resolved:**

1. `CHROMIUM_EXECUTABLE_PATH` in `api\.env`, if set — always wins.
2. Otherwise (with `BROWSER_PROVIDER=npm`) the path exported by the `chromium` npm package (`require('chromium').path`).

The API passes the resolved path to test runs via `launchOptions.executablePath` and to the codegen recorder via the `PWTEST_CLI_EXECUTABLE_PATH` environment variable (the only override `playwright codegen` honors).

**Verify the npm package actually downloaded a binary** (its postinstall also downloads Chromium — from `commondatastorage.googleapis.com`, which some proxies block silently):

```powershell
node -e "console.log(require('chromium').path)"
# Then check the printed file exists.
```

### Option C — use an already-installed Chrome or Edge (no downloads at all)

If both downloads are blocked, point the platform at the browser already on the machine — Playwright drives stable Chrome/Edge fine:

```env
BROWSER_PROVIDER=npm
CHROMIUM_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
# or: C:\Program Files\Google\Chrome\Application\chrome.exe
```

No `npm run test:chromium:install` needed in this mode — `CHROMIUM_EXECUTABLE_PATH` short-circuits the package lookup.

---

## 5. Configure environment variables

Copy the example env file:

```powershell
Copy-Item api\.env.example api\.env
```

Edit `api\.env` in Notepad, VS Code, or Cursor.

### Database provider

| `DB_PROVIDER` | Description |
|---------------|-------------|
| `prisma` (default) | SQLite via Prisma — run migrations (step 6) |
| `json` | Single JSON file store — no Prisma/SQLite at runtime |
| `oracle` | Oracle DB — run `api\database\oracle\schema.sql`, install `oracledb` |

**JSON file store example** (no SQLite):

```env
DB_PROVIDER=json
JSON_DB_PATH=../data/platform.json
```

Skip Prisma migrate steps when using `json` or `oracle`.

**Oracle example:**

```env
DB_PROVIDER=oracle
ORACLE_USER=pp_user
ORACLE_PASSWORD=your-password
ORACLE_CONNECTION_STRING=localhost:1521/XEPDB1
```

```powershell
npm install oracledb --workspace=api
```

### Minimum recommended settings

```env
DATABASE_URL="file:../data/db.sqlite"
DB_PROVIDER=prisma
BROWSER_PROVIDER=playwright
SECRETS_ENCRYPTION_KEY="change-me-in-production-32chars!!"
ARTIFACTS_DIR="../artifacts"
TESTS_DIR="../tests"
LLM_PROVIDER=stellar
STELLAR_API_URL=http://localhost:8080/apiv1/stellar/chat
AUTH_ENABLED=false
```

### LLM provider

| `LLM_PROVIDER` | Description |
|----------------|-------------|
| `stellar` (default) | Local/internal endpoint at `STELLAR_API_URL`. Request body: `{ "systemPrompt": "...", "userMessage": "..." }`. No API key. |
| `openai` | OpenAI Chat Completions. Requires `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4o`). |

**Important (Windows):**

- Keep paths in `.env` with **forward slashes** (`../data/db.sqlite`) — they work correctly with Prisma on Windows.
- Wrap values that contain special characters in **double quotes**.
- Do **not** commit `api\.env` (it is gitignored).

For LLM test generation and the recorder, the stellar endpoint must be reachable (or, with `LLM_PROVIDER=openai`, `OPENAI_API_KEY` must be set). The rest of the app runs without an LLM, but recording → Generate with LLM will fail until one is configured.

---

## 6. Build shared packages and database

Run these from the repo root:

```powershell
npm run build:shared-types
npm run db:generate
npm run db:migrate
```

- `db:migrate` creates/updates the SQLite database under `data\db.sqlite`.
- If prompted for a migration name during development, press Enter to accept the default.

**Production-style migrate (no prompts):**

```powershell
cd api
npx prisma migrate deploy
cd ..
```

---

## 7. Start the application

Use **two terminals** (both from the repo root).

**Terminal 1 — API (port 3000):**

```powershell
npm run start:api
```

**Terminal 2 — Web UI (port 4200):**

```powershell
npm run start:web
```

Open the app: **http://localhost:4200**

The Angular dev server proxies `/api` to `http://localhost:3000` (see `web/proxy.conf.json`).

### Port 3000 already in use

If another app (Docker, IIS, etc.) uses port 3000:

```powershell
$env:PORT=3001
npm run start:api
```

Then update `web\proxy.conf.json` so `"target"` is `http://localhost:3001`, restart `npm run start:web`, and set `APP_BASE_URL=http://localhost:4200` in `api\.env`.

---

## 8. Verify the install

**API health check (PowerShell):**

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Or in **Git Bash / curl**:

```bash
curl http://localhost:3000/api/health
```

**In the UI:**

1. Go to **Projects** → create a project.
2. Open the project → **Test suites** → create a suite.
3. **Record test** or add a test case, then **Run suite** from the suite page.
4. Open the run detail page to see **Steps**, **Log**, and **Screenshots & video**.

---

## 9. Windows-specific tips

### Watch tests in a visible browser

On the suite page, enable **Watch in browser** before **Run suite**. A Chromium window opens on the **same machine running the API** (your Windows PC). Headed mode does not work if the API runs inside Docker/WSL without a display.

### Screenshot and video capture

Project → **Configuration** → **Run capture**:

- **Screenshots:** Off / On failure / Every step  
- **Video:** Off / On failure / Always record  

Re-run the suite after changing settings; older runs will not have new artifacts.

### Edit tests after saving

Suite → test case → **Edit source** to change feature files, step definitions, and page objects on disk.

### Firewall / corporate network

Allow Node.js through Windows Firewall for localhost ports **3000** and **4200**. External sites under test (e.g. MSN, NSE) must be reachable from your network; some sites block automated browsers.

### Line endings

Git may warn about `LF` vs `CRLF`. For this repo, either is fine for development. To avoid noise:

```powershell
git config core.autocrlf true
```

---

## 10. Optional: enable authentication

In `api\.env`:

```env
AUTH_ENABLED=true
JWT_SECRET=your-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password
```

Restart the API. Sign in at **http://localhost:4200/login**.

---

## 11. Troubleshooting

| Problem | What to try |
|---------|-------------|
| `ECONNREFUSED` / proxy errors on `/api/...` | Start the API first (`npm run start:api`). Confirm http://localhost:3000/api/health responds. |
| `npm install` errors | Run PowerShell **as Administrator** once, or install [Windows Build Tools](https://github.com/nodejs/node-gyp#on-windows). Ensure Node 20+. |
| Playwright browser missing | `npm run test:playwright:install` from repo root. |
| Prisma / database errors | Delete `data\db.sqlite` (dev only), then `npm run db:migrate` again. |
| LLM generation fails | With `LLM_PROVIDER=stellar` (default): confirm the endpoint responds, e.g. `curl -X POST http://localhost:8080/apiv1/stellar/chat -H "Content-Type: application/json" -d '{"systemPrompt":"hi","userMessage":"hi"}'`. With `openai`: check `OPENAI_API_KEY` in `api\.env` and model access. Restart the API after changing `.env`. |
| Tests fail immediately | Open run detail → **Log** tab. Ensure `tests\features`, `tests\steps`, and `tests\page-objects` files exist for Gherkin tests. |

---

## 12. Useful commands (reference)

```powershell
# Build everything
npm run build

# Open Prisma DB GUI
npm run db:studio

# Run Playwright tests directly (optional)
npm run test:playwright

# Test LLM prompts (uses stellar by default; set LLM_PROVIDER=openai + OPENAI_API_KEY for OpenAI)
npm run prompt:test
```

---

## Repository layout (quick reference)

```
playwright-platform/
  web/              Angular UI
  api/              NestJS API + Prisma
  shared-types/     Shared TypeScript types
  codegen-engine/   LLM prompts and generation
  tests/            Playwright specs, Gherkin features, page objects
  data/             SQLite database (created after migrate)
  artifacts/        Test run logs, screenshots, videos
```

For architecture and roadmap, see [PLAN.md](./PLAN.md).
