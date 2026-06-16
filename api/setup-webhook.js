const { getEnv } = require("../src/config.js");

const TELEGRAM_API = "https://api.telegram.org/bot";

module.exports = async function handler(req, res) {
  try {
    const env = getEnv();
    const baseUrl = req.headers["x-forwarded-host"]
      ? `https://${req.headers["x-forwarded-host"]}`
      : `http://${req.headers.host || "localhost:4000"}`;

    const webhookUrl = `${baseUrl}/api/telegram-webhook`;
    const apiUrl = `${TELEGRAM_API}${env.telegramBotToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

    const response = await fetch(apiUrl, { method: "POST" });
    const data = await response.json();

    return res.status(200).json({
      status: data.ok ? "ok" : "error",
      telegram_response: data,
      webhook_url: webhookUrl,
    });
  } catch (error) {
    return res.status(500).json({ status: "error", error: error.message });
  }
};
