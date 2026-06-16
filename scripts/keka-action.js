const { chromium } = require('playwright');
const { isWeekend, getRandomDelaySeconds, sleep } = require('../src/utils.js');
const { sendTelegramMessage } = require('../src/telegram.js');

const KEKA_URL = 'https://tvsnext.keka.com';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;

async function run() {
  const email = process.env.KEKA_EMAIL;
  const password = process.env.KEKA_PASSWORD;

  if (!email || !password) {
    console.error('Missing KEKA_EMAIL or KEKA_PASSWORD');
    process.exit(1);
  }

  const action = process.env.KEKA_ACTION || guessAction();
  if (action !== 'in' && action !== 'out') {
    console.error('KEKA_ACTION must be "in" or "out"');
    process.exit(1);
  }
  const label = action === 'in' ? 'Clock-In' : 'Clock-Out';
  console.log(`[${label}] Starting...`);

  if (isWeekend()) {
    const msg = `<b>⏭️ ${label} Skipped</b>\n\nToday is a weekend.`;
    console.log(`[${label}] Weekend — skipped.`);
    await sendTelegramMessage(BOT_TOKEN, CHAT_ID, msg);
    return;
  }

  const maxDelay = action === 'in' ? 5 : 10;
  const delay = getRandomDelaySeconds(maxDelay);
  if (delay > 0) {
    console.log(`[${label}] Waiting ${delay}s (random delay).`);
    await sleep(delay);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  });
  const page = await context.newPage();

  try {
    console.log(`[${label}] Navigating to Keka...`);
    await page.goto(KEKA_URL, { waitUntil: 'networkidle', timeout: 30000 });

    console.log(`[${label}] Logging in...`);
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log(`[${label}] Login submitted, waiting for dashboard...`);
    await page.waitForTimeout(3000);

    console.log(`[${label}] Navigating to attendance...`);
    await page.goto(`${KEKA_URL}/k/attendance`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const buttonText = action === 'in' ? 'Clock In' : 'Clock Out';
    console.log(`[${label}] Clicking "${buttonText}"...`);

    let clicked = false;
    const selectors = [
      `button:has-text("${buttonText}")`,
      `a:has-text("${buttonText}")`,
      `span:has-text("${buttonText}")`,
      `[class*="clock"]:has-text("${buttonText}")`,
    ];

    for (const sel of selectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        clicked = true;
        console.log(`[${label}] Clicked via: ${sel}`);
        break;
      }
    }

    if (!clicked) {
      throw new Error(`Could not find "${buttonText}" button on the page`);
    }

    await page.waitForTimeout(3000);

    const now = new Date();
    const successMsg =
      `<b>✅ ${label} Successful</b>\n\n` +
      `Time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n` +
      `Date: ${now.toLocaleDateString('en-IN')}`;

    console.log(`[${label}] Successful.`);
    await sendTelegramMessage(BOT_TOKEN, CHAT_ID, successMsg);
  } catch (error) {
    console.error(`[${label}] Failed: ${error.message}`);

    try {
      await page.screenshot({ path: `/tmp/keka-${label}-error.png`, fullPage: true });
      console.log(`[${label}] Screenshot saved to /tmp/keka-${label}-error.png`);
    } catch {}

    const failMsg =
      `<b>❌ ${label} Failed</b>\n\nError: ${error.message}`;
    await sendTelegramMessage(BOT_TOKEN, CHAT_ID, failMsg);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

function guessAction() {
  const hour = new Date().getUTCHours();
  return hour >= 4 && hour < 14 ? 'in' : 'out';
}

run();
