# Session Context

## Project
- **Name:** Keka Clock Automation
- **Repo:** tvs_keka_Automation
- **Purpose:** Automates daily clock-in/out on TVS Next's Keka portal via Playwright + GitHub Actions + Telegram notifications

## Tech Stack
- Node.js 18+ (CommonJS)
- Playwright (browser automation — Chromium headless)
- GitHub Actions (scheduled cron + manual dispatch)
- Vercel (optional — Telegram webhook only for interactive commands)
- No test framework — `node --check` for linting

## Architecture

```
scripts/      — Automation scripts
  keka-action.js   — Playwright: login to Keka, clock-in/out, Telegram notification
.github/workflows/
  schedule.yml     — GitHub Actions cron (weekdays 10AM / 8PM IST)
api/          — Vercel function handlers (optional, Telegram webhook)
  clockin.js / clockout.js     — Legacy token-based (kept for webhook)
  test-clockin.js / test-clockout.js  — Manual GET triggers
  health.js / ping.js           — Status endpoints
  telegram-webhook.js           — Bot commands (/Clock-In, /Clock-Out)
  setup-webhook.js              — Registers Telegram webhook URL
src/          — Shared logic
  config.js    — Env var validation (legacy, kept for webhook)
  auth.js      — OAuth2 token mgmt (legacy, kept for webhook)
  keka.js      — Keka webclockin API client (legacy, kept for webhook)
  telegram.js  — Telegram Bot API message sender
  utils.js     — isWeekend, getCurrentTimestamp, random delay, sleep
```

## Key Details
- **Cron (UTC):** clock-in `30 4 * * 1-5` (~10:00 AM IST), clock-out `30 14 * * 1-5` (~8:00 PM IST)
- **Auth:** Email/password via Playwright browser login — no expiring tokens
- **Random delay:** 0-5min for clock-in, 0-10min for clock-out
- **Notifications:** Telegram (push via GitHub Actions, interactive via Vercel webhook)
- **Weekends:** Automatically skipped
- **Manual trigger:** GitHub UI → Actions → Keka Clock Automation → Run workflow
- **Local test:** `KEKA_ACTION=in KEKA_EMAIL=x KEKA_PASSWORD=y node scripts/keka-action.js`
- **Secrets required in GitHub:** `KEKA_EMAIL`, `KEKA_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## Session Goals
All files read and understood. Ready for feature work, bug fixes, refactoring, or analysis.

## Known Issues / Fixes Applied
- **Jun 15 (Session):** Fixed HTTP 401 errors on cron-automated clock-in/out.
  - `auth.js`: Added `getClientIdFromToken()` — extracts `client_id` from JWT payload when `KEKA_CLIENT_ID` env var is missing, enabling refresh token flow without manual config.
  - `auth.js`: Added error logging in refresh catch block so failed refreshes are visible.
  - `keka.js`: `submitAttendance` now calls `getToken()` first (handles expiry check + auto-refresh) instead of blindly using the passed-in `existingToken`. Avoids the first request being wasted on an expired token.
- **Jun 16 (Session):** Replaced token-based Vercel cron with Playwright + GitHub Actions.
  - New file: `scripts/keka-action.js` — Playwright browser automation
  - New file: `.github/workflows/schedule.yml` — GitHub Actions cron
  - Updated `vercel.json` — crons removed (handled by GitHub Actions now)
  - Updated `.env.example` — simplified to KEKA_EMAIL / KEKA_PASSWORD
  - Added `playwright` npm dependency
  - Vercel kept only for Telegram webhook (interactive commands)
