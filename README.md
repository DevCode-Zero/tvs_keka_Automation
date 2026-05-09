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
│   ├── clockout.js        # Cron-triggered clock-out endpoint
│   ├── test-clockout.js   # Manual test endpoint
│   └── health.js          # Health check endpoint
├── src/
│   ├── config.js          # Environment variable validation
│   ├── keka.js            # Keka API client (retry + timeout)
│   ├── telegram.js        # Telegram notification client
│   └── utils.js           # Utility functions
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

### 1. Get Your Keka Token

1. Log in to your Keka portal (e.g., `https://tvsnext.keka.com`).
2. Open **Developer Tools** → **Network** tab.
3. Filter by `webclockout` or `attendance`.
4. Click any request and copy the `Authorization: Bearer <token>` header value.
5. Save this token — it will be your `KEKA_TOKEN`.

> **Note:** Keka tokens expire periodically. When they do, the clock-out will fail and you'll need to repeat this process to get a fresh token.

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in the values:

| Variable | Required | Description |
|---|---|---|
| `KEKA_TOKEN` | ✅ Yes | Bearer token from Keka API |
| `TELEGRAM_BOT_TOKEN` | ❌ No | Telegram bot token (from @BotFather) |
| `TELEGRAM_CHAT_ID` | ❌ No | Your Telegram chat ID |

### 3. Local Development

```bash
npm install
vercel dev
```

Test endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check + environment status |
| `GET /test-clockout` | Manually trigger clock-out |
| `POST /clockout` | Cron-triggered clock-out |

## Deployment

### 1. Deploy to Vercel

```bash
vercel --prod
```

### 2. Add Environment Variables on Vercel

```bash
vercel env add KEKA_TOKEN
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_CHAT_ID
```

Or add them via the **Vercel Dashboard** → Project → Settings → Environment Variables.

### 3. Verify Deployment

Visit `https://your-project.vercel.app/api/health` — you should see a JSON health report.

## Updating an Expired Keka Token

1. Log in to Keka and grab a fresh token (same process as step 1).
2. Update the environment variable:

```bash
vercel env rm KEKA_TOKEN
vercel env add KEKA_TOKEN
vercel redeploy
```

Or update via the Vercel Dashboard → Environment Variables, then redeploy.

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
- ✅ 3 retries with exponential backoff on failure
- ✅ 30-second request timeout (AbortController)
- ✅ Random 0–5 min delay before clock-out
- ✅ Telegram notification on success/failure
- ✅ Health check endpoint
- ✅ Manual test endpoint
- ✅ JSON responses everywhere
- ✅ Full error handling and logging

## License

MIT
