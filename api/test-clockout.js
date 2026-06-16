const { getEnv } = require("../src/config.js");
const { submitAttendance } = require("../src/keka.js");
const { sendTelegramMessage } = require("../src/telegram.js");

module.exports = async function handler(req, res) {
  const startTime = Date.now();

  try {
    const env = getEnv();

    console.log("[Test] Manual clock-out triggered.");

    const result = await submitAttendance(env.kekaToken, 1);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result.success) {
      const msg =
        "<b>🧪 Test Clock-Out Successful</b>\n\n" +
        `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n` +
        `Duration: ${elapsed}s`;

      await sendTelegramMessage(env.telegramBotToken, env.telegramChatId, msg);

      return res.status(200).json({
        status: "success",
        duration_seconds: parseFloat(elapsed),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      status: "error",
      error: result.error,
      duration_seconds: parseFloat(elapsed),
    });

  } catch (error) {
    console.error(`[Test] Unhandled error: ${error.message}`);
    return res.status(500).json({
      status: "error",
      error: error.message,
      duration_seconds: ((Date.now() - startTime) / 1000).toFixed(2),
    });
  }
};
