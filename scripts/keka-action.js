const { chromium } = require('playwright');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { isWeekend } = require('../src/utils.js');
const { sendTelegramMessage } = require('../src/telegram.js');

const KEKA_URL = 'https://tvsnext.keka.com';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;
const STORAGE_FILE = process.env.STORAGE_FILE || '/tmp/keka-state.json';

async function solveCaptcha(page) {
  try {
    // Wait for captcha image to load with a non-empty src
    const img = await page.waitForSelector('#imgCaptcha[src]', { timeout: 8000 }).catch(() => null);
    if (!img) {
      console.log('[Captcha] #imgCaptcha not found');
      return null;
    }
    await page.waitForTimeout(500);

    // Try element screenshot first (cleanest capture)
    const capBuf = await img.screenshot();
    const processed = await sharp(capBuf).resize(600, 210, { fit: 'fill' }).grayscale().normalise().threshold(150).sharpen().png().toBuffer();
    const { data: data2 } = await Tesseract.recognize(processed, 'eng', {
      logger: () => {},
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      tessedit_pageseg_mode: '7',
    });
    let text = data2.text.replace(/[^A-Z0-9]/g, '').trim();
    if (text.length >= 4 && text.length <= 6) {
      console.log(`[Captcha] OCR: "${text}"`);
      return text;
    }

    // Fallback: decode data:image src directly
    const src = await img.getAttribute('src');
    if (src && src.startsWith('data:image')) {
      const raw = Buffer.from(src.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const png2 = await sharp(raw).resize(600, 210, { fit: 'fill' }).grayscale().normalise().threshold(150).sharpen().png().toBuffer();
      const { data: data3 } = await Tesseract.recognize(png2, 'eng', {
        logger: () => {},
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '7',
      });
      text = data3.text.replace(/[^A-Z0-9]/g, '').trim();
      if (text.length >= 4 && text.length <= 6) {
        console.log(`[Captcha] OCR (data:image): "${text}"`);
        return text;
      }
    }

    console.log(`[Captcha] OCR rejected (len ${text.length}): "${text}"`);
    return null;
  } catch (err) {
    console.log(`[Captcha] Error: ${err.message}`);
    return null;
  }
}

async function doLogin(page, email, password, label) {
  console.log(`[${label}] Logging in...`);

  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // On retry, reload and let SPA redirect to login page
    if (attempt > 1) {
      await page.goto(KEKA_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForURL('**/Account/KekaLogin**', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.waitForSelector('#email', { timeout: 15000 });
    await page.fill('#email', email);
    await page.fill('#password', password);

    const captchaInput = await page.$('#captcha');
    const captchaVisible = captchaInput && await captchaInput.isVisible();

    if (captchaVisible) {
      console.log(`[${label}] Attempt ${attempt}/${maxRetries} — solving captcha...`);
      const text = await solveCaptcha(page);
      if (text) {
        console.log(`[${label}] Captcha value: "${text}"`);
        await page.fill('#captcha', text);
      } else {
        console.log(`[${label}] Could not solve captcha — retrying...`);
        continue;
      }
    }

    const btn = await page.$('button:has-text("Login")');
    if (btn) {
      await btn.click();
      console.log(`[${label}] Clicked Login button.`);
    } else {
      await page.keyboard.press('Enter');
      console.log(`[${label}] Pressed Enter.`);
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);

    const afterUrl = page.url();
    console.log(`[${label}] Post-login URL: ${afterUrl}`);

    if (!afterUrl.includes('/Account/KekaLogin')) {
      console.log(`[${label}] Login successful on attempt ${attempt}.`);
      return;
    }

    console.log(`[${label}] Attempt ${attempt} failed — will retry.`);
  }

  throw new Error('Login failed after all retries. Run locally with HEADED=true to login manually once.');
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

  // Random delay removed — login immediately

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

    const failMsg = `<b>❌ ${label} Failed</b>\n\nError: ${error.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
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
