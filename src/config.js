export function validateEnv() {
  const required = ["KEKA_TOKEN"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

export function getEnv() {
  validateEnv();

  return {
    kekaToken: process.env.KEKA_TOKEN,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
    telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
  };
}
