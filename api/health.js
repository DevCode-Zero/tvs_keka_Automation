module.exports = async function handler(req, res) {
  const envVars = {
    KEKA_TOKEN: process.env.KEKA_TOKEN ? "OK" : "MISSING",
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? "OK" : "MISSING",
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? "OK" : "MISSING",
  };

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: envVars,
  });
};
