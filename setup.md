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

## 4. Install Playwright Chromium

The API runs tests using headless Chromium. Install it once:

```powershell
npm run test:playwright:install
```

If the install fails, run Playwright’s dependency checker:

```powershell
cd tests
npx playwright install chromium
npx playwright install-deps chromium
cd ..
```

---

## 5. Configure environment variables

Copy the example env file:

```powershell
Copy-Item api\.env.example api\.env
```

Edit `api\.env` in Notepad, VS Code, or Cursor. Minimum recommended settings:

```env
DATABASE_URL="file:../data/db.sqlite"
SECRETS_ENCRYPTION_KEY="change-me-in-production-32chars!!"
ARTIFACTS_DIR="../artifacts"
TESTS_DIR="../tests"
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4o"
AUTH_ENABLED=false
```

**Important (Windows):**

- Keep paths in `.env` with **forward slashes** (`../data/db.sqlite`) — they work correctly with Prisma on Windows.
- Wrap values that contain special characters in **double quotes**.
- Do **not** commit `api\.env` (it is gitignored).

For LLM test generation and the recorder, `OPENAI_API_KEY` is required. The rest of the app runs without it, but recording → Generate with LLM will fail until the key is set.

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
| LLM generation fails | Check `OPENAI_API_KEY` in `api\.env`, restart API, confirm billing/access for the model in `OPENAI_MODEL`. |
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

# Test LLM prompts (requires OPENAI_API_KEY)
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
