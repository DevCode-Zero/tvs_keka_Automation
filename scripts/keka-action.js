const { chromium } = require('playwright');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { isWeekend, getRandomDelaySeconds, sleep } = require('../src/utils.js');
const { sendTelegramMessage } = require('../src/telegram.js');

const KEKA_URL = 'https://tvsnext.keka.com';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;

async function solveCaptcha(page) {
  try {
    const img = await page.$('#imgCaptcha');
    if (!img) return null;
    const src = await img.getAttribute('src');
    if (!src || !src.startsWith('data:image')) return null;

    const buf = Buffer.from(src.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    const processed = await sharp(buf).grayscale().normalise().threshold(128).resize(400, 140, { fit: 'fill' }).sharpen().png().toBuffer();

    const { data } = await Tesseract.recognize(processed, 'eng', {
      logger: () => {},
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      tessedit_pageseg_mode: '7',
    });

    return data.text.replace(/[^A-Z0-9]/g, '').trim();
  } catch {
    return null;
  }
}

async function login(page, email, password, label) {
  console.log(`[${label}] Logging in...`);

  await page.waitForSelector('#email', { timeout: 10000 });
  await page.fill('#email', email);
  await page.fill('#password', password);

  const loginBtn = await page.$('button:has-text("Login")');

  if (loginBtn) {
    // Check if captcha is required
    const captchaInput = await page.$('#captcha');
    const captchaVisible = captchaInput && await captchaInput.isVisible();

    if (captchaVisible) {
      console.log(`[${label}] Captcha required — solving...`);
      const text = await solveCaptcha(page);
      if (text) {
        console.log(`[${label}] Captcha OCR: "${text}"`);
        await captchaInput.fill(text);
      }
    }

    await loginBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // If still on login page, OCR was wrong — retry once
    if (captchaVisible && page.url().includes('/Account/KekaLogin')) {
      console.log(`[${label}] Captcha wrong — retrying with refreshed captcha...`);
      const refreshBtn = await page.$('#retryCaptcha');
      if (refreshBtn) await refreshBtn.click();
      await page.waitForTimeout(1500);

      await page.fill('#email', email);
      await page.fill('#password', password);

      const newText = await solveCaptcha(page);
      if (newText) {
        console.log(`[${label}] Captcha OCR (retry): "${newText}"`);
        const newInput = await page.$('#captcha');
        if (newInput) await newInput.fill(newText);
      }

      await loginBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(2000);
    }
  } else {
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  }

  if (page.url().includes('/Account/KekaLogin')) {
    throw new Error('Login failed — captcha could not be solved');
  }

  console.log(`[${label}] Login successful.`);
}

async function clickPunchButton(page, action, label) {
  const buttonText = action === 'in' ? 'Clock In' : 'Clock Out';
  console.log(`[${label}] Looking for "${buttonText}"...`);

  await page.waitForTimeout(3000);

  const selectors = [
    `button:has-text("${buttonText}")`,
    `a:has-text("${buttonText}")`,
    `[class*="clock"]:has-text("${buttonText}")`,
    `text="${buttonText}"`,
    `#webClockInBtn`,
    `[data-testid*="clock"]`,
    `[aria-label*="Clock"]`,
  ];

  for (const sel of selectors) {
    const els = await page.$$(sel);
    for (const el of els) {
      try {
        await el.click({ timeout: 3000 });
        console.log(`[${label}] Clicked: ${sel}`);
        return true;
      } catch {}
    }
  }

  // Tree walker as last resort
  const found = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() === text) {
        const parent = node.parentElement;
        if (parent) { parent.click(); return true; }
      }
    }
    return false;
  }, buttonText);

  if (found) return true;

  // Dump page text for debugging
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log(`[${label}] Page text (first 1000):`, pageText?.substring(0, 1000));
  return false;
}

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

  const maxDelay = action === 'in' ? (process.env.TEST_MODE ? 0 : 5) : (process.env.TEST_MODE ? 0 : 10);
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
    await page.goto(KEKA_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForURL('**/Account/KekaLogin**', { timeout: 20000 });

    await login(page, email, password, label);

    console.log(`[${label}] Post-login URL: ${page.url()}`);

    await page.goto(`${KEKA_URL}/k/attendance`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const clicked = await clickPunchButton(page, action, label);
    if (!clicked) throw new Error(`Could not find "${action === 'in' ? 'Clock In' : 'Clock Out'}" button`);

    await page.waitForTimeout(3000);

    const now = new Date();
    const successMsg = `<b>✅ ${label} Successful</b>\n\n` +
      `Time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n` +
      `Date: ${now.toLocaleDateString('en-IN')}`;

    console.log(`[${label}] Successful.`);
    await sendTelegramMessage(BOT_TOKEN, CHAT_ID, successMsg);
  } catch (error) {
    console.error(`[${label}] Failed: ${error.message}`);

    try {
      await page.screenshot({ path: `/tmp/keka-${label}-error.png`, fullPage: true });
      console.log(`[${label}] Screenshot saved`);
    } catch {}

    const failMsg = `<b>❌ ${label} Failed</b>\n\nError: ${error.message}`;
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
