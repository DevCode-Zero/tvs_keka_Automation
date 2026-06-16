const { getEnv } = require("../src/config.js");
const { submitAttendance } = require("../src/keka.js");
const { sendTelegramMessage } = require("../src/telegram.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const update = req.body;

    if (!update || !update.message || !update.message.text) {
      return res.status(200).json({ status: "ignored" });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const env = getEnv();

    let result;
    let label;

    if (text === "/Clock-In" || text === "/clock-in") {
      label = "Clock-In";
      result = await submitAttendance(env.kekaToken, 0);
    } else if (text === "/Clock-Out" || text === "/clock-out") {
      label = "Clock-Out";
      result = await submitAttendance(env.kekaToken, 1);
    } else {
      await sendTelegramMessage(
        env.telegramBotToken,
        chatId,
        "Available commands:\n\n/Clock-In — Punch in\n/Clock-Out — Punch out"
      );
      return res.status(200).json({ status: "unknown_command" });
    }

    if (result.success) {
      await sendTelegramMessage(
        env.telegramBotToken,
        chatId,
        `<b>✅ ${label} Successful</b>\n\n` +
        `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n` +
        `Date: ${new Date().toLocaleDateString("en-IN")}`
      );
    } else {
      await sendTelegramMessage(
        env.telegramBotToken,
        chatId,
        `<b>❌ ${label} Failed</b>\n\nError: ${result.error}`
      );
    }

    return res.status(200).json({ status: "processed" });
  } catch (error) {
    console.error(`[Telegram-Webhook] Error: ${error.message}`);
    return res.status(200).json({ status: "error", error: error.message });
  }
};
