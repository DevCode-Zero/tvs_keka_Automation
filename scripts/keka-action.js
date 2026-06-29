const { chromium } = require('playwright');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { isWeekend, getRandomDelaySeconds, sleep } = require('../src/utils.js');
const { sendTelegramMessage } = require('../src/telegram.js');

const KEKA_URL = 'https://tvsnext.keka.com';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;
const STORAGE_FILE = process.env.STORAGE_FILE || '/tmp/keka-state.json';

async function solveCaptcha(page) {
  try {
    const captchaContainer = await page.$('#captcha, .captcha-img, [class*="captcha"] img');
    if (!captchaContainer) {
      console.log('[Captcha] No captcha container found');
      return null;
    }

    const img = await page.$('#imgCaptcha, .captcha-img, [class*="captcha"] img');
    if (!img) {
      console.log('[Captcha] No captcha img element found');
      return null;
    }

    let src = await img.getAttribute('src');

    // If not data:image, try to screenshot the element directly
    if (!src || !src.startsWith('data:image')) {
      console.log('[Captcha] img src is not data:image, taking screenshot instead');
      const clip = await img.boundingBox();
      if (!clip) return null;
      const buf = await page.screenshot({ clip, type: 'png' });
      const processed = await sharp(buf).grayscale().normalise().threshold(140).resize(400, 140, { fit: 'fill' }).sharpen().negate().png().toBuffer();

      const { data } = await Tesseract.recognize(processed, 'eng', {
        logger: () => {},
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '7',
      });
      const result = data.text.replace(/[^A-Z0-9]/g, '').trim();
      console.log(`[Captcha] OCR result (screenshot): "${result}"`);
      return result;
    }

    const buf = Buffer.from(src.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const processed = await sharp(buf).grayscale().normalise().threshold(128).resize(400, 140, { fit: 'fill' }).sharpen().png().toBuffer();

    const { data } = await Tesseract.recognize(processed, 'eng', {
      logger: () => {},
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      tessedit_pageseg_mode: '7',
    });

    const result = data.text.replace(/[^A-Z0-9]/g, '').trim();
    console.log(`[Captcha] OCR result (data:image): "${result}"`);
    return result;
  } catch (err) {
    console.log(`[Captcha] Error: ${err.message}`);
    return null;
  }
}

async function doLogin(page, email, password, label) {
  console.log(`[${label}] Logging in...`);

  await page.waitForSelector('#email', { timeout: 10000 });
  await page.fill('#email', email);
  await page.fill('#password', password);

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

  const btn = await page.$('button:has-text("Login")');
  if (btn) await btn.click();
  else await page.keyboard.press('Enter');

  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForTimeout(3000);

  if (page.url().includes('/Account/KekaLogin') && captchaVisible) {
    console.log(`[${label}] Captcha wrong — retrying with refreshed captcha...`);
    const refreshBtn = await page.$('#retryCaptcha');
    if (refreshBtn) await refreshBtn.click();
    await page.waitForTimeout(1500);

    await page.fill('#email', email);
    await page.fill('#password', password);

    const text2 = await solveCaptcha(page);
    if (text2) {
      console.log(`[${label}] Captcha OCR (retry): "${text2}"`);
      const newInput = await page.$('#captcha');
      if (newInput) await newInput.fill(text2);
    }

    if (refreshBtn) {
      const btn2 = await page.$('button:has-text("Login")');
      if (btn2) await btn2.click();
      else await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(3000);
    }
  }

  if (page.url().includes('/Account/KekaLogin')) {
    throw new Error('Login failed (captcha or invalid credentials). Run locally with HEADED=true to login manually once.');
  }

  console.log(`[${label}] Login successful.`);
}

async function isLoggedIn(page) {
  await page.goto(KEKA_URL, { waitUntil: 'networkidle', timeout: 30000 });
  // If SPA redirects to login, we're not logged in
  const url = page.url();
  if (url.includes('/Account/KekaLogin') || url.includes('/connect/authorize')) {
    return false;
  }
  // Wait for SPA to fully load
  await page.waitForTimeout(3000);
  return !page.url().includes('Account') && !page.url().includes('authorize');
}

async function clickPunchButton(page, action, label) {
  const buttonText = action === 'in' ? 'Clock In' : 'Clock Out';
  console.log(`[${label}] Looking for "${buttonText}"...`);

  await page.waitForTimeout(3000);

  const selectors = [
    `button:has-text("${buttonText}")`,
    `a:has-text("${buttonText}")`,
    `[class*="clock"]`,
    `text="${buttonText}"`,
    `#webClockInBtn`,
    `[data-testid*="clock"]`,
    `[aria-label*="Clock"]`,
  ];

  for (const sel of selectors) {
    const els = await page.$$(sel);
    for (const el of els) {
      const text = await el.textContent();
      if (text && (text.includes('Clock In') || text.includes('Clock Out') || text.includes('Punch'))) {
        try { await el.click({ timeout: 3000 }); console.log(`[${label}] Clicked: ${sel}`); return true; } catch {}
      }
    }
  }

  // Tree walker
  const found = await page.evaluate((text) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() === text) {
        const p = node.parentElement;
        if (p) { p.click(); return true; }
      }
    }
    return false;
  }, buttonText);

  if (found) return true;

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log(`[${label}] Page text (first 2000):`, pageText?.substring(0, 2000));
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

  const headless = process.env.HEADED ? false : true;
  const browser = await chromium.launch({ headless });

  const contextOptions = {
    viewport: { width: 1280, height: 720 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  };

  // Load saved session if available
  if (fs.existsSync(STORAGE_FILE)) {
    contextOptions.storageState = STORAGE_FILE;
    console.log(`[${label}] Loading saved session from ${STORAGE_FILE}`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      console.log(`[${label}] No valid session — need to login.`);
      await page.waitForURL('**/Account/KekaLogin**', { timeout: 20000 });
      await doLogin(page, email, password, label);
      await context.storageState({ path: STORAGE_FILE });
      console.log(`[${label}] Session saved to ${STORAGE_FILE}`);
    } else {
      console.log(`[${label}] Using saved session.`);
    }

    console.log(`[${label}] Navigating to attendance...`);
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
