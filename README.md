# Keka Clock-Out Automation

Automatically clock-out from Keka every weekday at **6:30 PM IST** using Vercel Cron Jobs — no browser automation required.

## How It Works

1. Vercel Cron triggers `POST /api/clockout` at **Mon–Fri 1:00 PM UTC** (6:30 PM IST).
2. The function sends a direct HTTP request to Keka's Web Clock-Out API.
3. On success, an optional Telegram notification is sent.
4. If the request fails, up to **3 retries** with exponential backoff are attempted.
5. Weekends are automatically skipped.
6. A random 0–5 minute delay is added before clock-out to avoid predictability.

## Project Structure

```
keka-clockout/
├── api/
│   ├── clockin.js         # Cron-triggered clock-in endpoint
│   ├── clockout.js        # Cron-triggered clock-out endpoint
│   ├── test-clockin.js    # Manual test endpoint (clock-in)
│   ├── test-clockout.js   # Manual test endpoint (clock-out)
│   ├── health.js          # Health check endpoint
│   ├── ping.js            # Simple ping endpoint
│   ├── telegram-webhook.js
│   └── setup-webhook.js
├── src/
│   ├── auth.js            # OAuth token management (refresh, cache)
│   ├── config.js          # Environment variable validation
│   ├── keka.js            # Keka API client (retry + timeout)
│   ├── telegram.js        # Telegram notification client
│   └── utils.js           # Utility functions
├── test-local.js          # Local dev server
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- A Keka account with web access

### 1. Get Your Keka Credentials

#### Option A: Access Token + Refresh Token (recommended, auto-refresh)

1. Log in to your Keka portal (e.g., `https://tvsnext.keka.com`).
2. Open **Developer Tools** → **Network** tab.
3. Filter by `connect/token`.
4. Find the `POST` request to `https://app.keka.com/connect/token`.
5. In the **Response** tab, copy:
   - `access_token` → save as `KEKA_TOKEN`
   - `refresh_token` → save as `KEKA_REFRESH_TOKEN`

The code will automatically refresh `KEKA_TOKEN` using `KEKA_REFRESH_TOKEN` when it expires.

#### Option B: Static Bearer Token

1. Filter by `webclockout` or `attendance`.
2. Click any API request and copy the `Authorization: Bearer <token>` header value.
3. Save this token as `KEKA_TOKEN`.

> **Note:** Static tokens expire in ~24h. Without a refresh token, you'll need to repeat this process when it expires.

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in the values (pick **one** auth method):

| Variable | Required | Description |
|---|---|---|
| `KEKA_TOKEN` | ✅ Yes* | Access token from Keka OAuth |
| `KEKA_REFRESH_TOKEN` | ❌ No | Refresh token (enables auto-refresh) |
| `KEKA_USERNAME` | ❌ No | Keka login email (alt. auth method) |
| `KEKA_PASSWORD` | ❌ No | Keka password (alt. auth method) |
| `KEKA_CLIENT_ID` | ❌ No | OAuth client ID (alt. auth method) |
| `KEKA_CLIENT_SECRET` | ❌ No | OAuth client secret (alt. auth method) |
| `TELEGRAM_BOT_TOKEN` | ❌ No | Telegram bot token (from @BotFather) |
| `TELEGRAM_CHAT_ID` | ❌ No | Your Telegram chat ID |

\* `KEKA_TOKEN` is required, but will be auto-refreshed if `KEKA_REFRESH_TOKEN` is also provided.

### 3. Local Development

```bash
npm install
vercel dev
```

Test endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check + environment status |
| `GET /test-clockin` | Manually trigger clock-in |
| `GET /test-clockout` | Manually trigger clock-out |
| `POST /clockin` | Cron-triggered clock-in |
| `POST /clockout` | Cron-triggered clock-out |

## Deployment

### 1. Deploy to Vercel

```bash
vercel --prod
```

### 2. Add Environment Variables on Vercel

```bash
vercel env add KEKA_TOKEN
vercel env add KEKA_REFRESH_TOKEN    # enables auto-refresh
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_CHAT_ID
```

Or add them via the **Vercel Dashboard** → Project → Settings → Environment Variables.

### 3. Verify Deployment

Visit `https://your-project.vercel.app/api/health` — you should see a JSON health report.

## Updating an Expired Keka Token

### If using a refresh token (recommended)

Just update the env vars and redeploy. The code auto-refreshes the access token using the refresh token:

```bash
vercel env rm KEKA_TOKEN
vercel env add KEKA_TOKEN
vercel env rm KEKA_REFRESH_TOKEN
vercel env add KEKA_REFRESH_TOKEN
vercel redeploy
```

### If using a static token only

1. Log in to Keka and grab a fresh token (same process as step 1).
2. Update the environment variable:

```bash
vercel env rm KEKA_TOKEN
vercel env add KEKA_TOKEN
vercel redeploy
```

Or update via the **Vercel Dashboard** → Environment Variables, then redeploy.

## Cron Schedule

Defined in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/clockout",
      "schedule": "0 13 * * 1-5"
    }
  ]
}
```

- `0 13 * * 1-5` = **1:00 PM UTC** = **6:30 PM IST** (Mon–Fri)
- Vercel Cron runs on the **Pro** plan. Hobby plan users can trigger the endpoint via an external cron service (e.g., cron-job.org).

## Features

- ✅ Direct HTTP API — no Playwright/browser automation
- ✅ Vercel Cron scheduling (Mon–Fri, 6:30 PM IST)
- ✅ Automatic weekend skip
- ✅ Clock-in and clock-out support
- ✅ Auto-refresh with refresh token (tokens last ~24h)
- ✅ 3 retries with exponential backoff on failure
- ✅ 30-second request timeout (AbortController)
- ✅ Random 0–5 min delay before clock-out
- ✅ Telegram notification on success/failure
- ✅ Health check endpoint
- ✅ Manual test endpoints
- ✅ JSON responses everywhere
- ✅ Full error handling and logging

## License

MIT
