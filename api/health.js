module.exports = async function handler(req, res) {
  const hasToken = !!process.env.KEKA_TOKEN;
  const hasCreds =
    !!process.env.KEKA_USERNAME &&
    !!process.env.KEKA_PASSWORD &&
    !!process.env.KEKA_CLIENT_ID;

  const envVars = {
    KEKA_AUTH: hasToken ? "token" : hasCreds ? "credentials" : "MISSING",
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? "OK" : "MISSING",
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? "OK" : "MISSING",
  };

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: envVars,
  });
};
