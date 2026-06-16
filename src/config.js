function validateEnv() {
  const hasToken = !!process.env.KEKA_TOKEN;
  const hasRefreshToken = !!process.env.KEKA_REFRESH_TOKEN;
  const hasCredentials =
    !!process.env.KEKA_USERNAME &&
    !!process.env.KEKA_PASSWORD &&
    !!process.env.KEKA_CLIENT_ID;

  if (!hasToken && !hasRefreshToken && !hasCredentials) {
    throw new Error(
      "Missing authentication. Set KEKA_TOKEN, KEKA_REFRESH_TOKEN, or KEKA_USERNAME + KEKA_PASSWORD + KEKA_CLIENT_ID."
    );
  }
}

function getEnv() {
  validateEnv();

  return {
    kekaUsername: process.env.KEKA_USERNAME || null,
    kekaPassword: process.env.KEKA_PASSWORD || null,
    kekaClientId: process.env.KEKA_CLIENT_ID || null,
    kekaClientSecret: process.env.KEKA_CLIENT_SECRET || null,
    kekaToken: process.env.KEKA_TOKEN || null,
    kekaRefreshToken: process.env.KEKA_REFRESH_TOKEN || null,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
    telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
  };
}

module.exports = { validateEnv, getEnv };
