const { getEnv } = require("../src/config.js");
const { clockOut } = require("../src/keka.js");
const { sendTelegramMessage } = require("../src/telegram.js");
const { isWeekend, getRandomDelaySeconds, sleep } = require("../src/utils.js");

module.exports = async function handler(req, res) {
  try {
    const env = getEnv();

    if (isWeekend()) {
      const message = "[Keka Clock-Out] Skipped — today is a weekend.";
      console.log(message);
      return res.status(200).json({ status: "skipped", reason: "weekend" });
    }

    const delay = getRandomDelaySeconds(5);
    if (delay > 0) {
      console.log(`[Keka] Waiting ${delay}s before clock-out (random delay).`);
      await sleep(delay);
    }

    const result = await clockOut(env.kekaToken);

    if (result.success) {
      const msg =
        "<b>✅ Keka Clock-Out Successful</b>\n\n" +
        `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n` +
        `Date: ${new Date().toLocaleDateString("en-IN")}`;

      await sendTelegramMessage(env.telegramBotToken, env.telegramChatId, msg);

      return res.status(200).json({ status: "success" });
    }

    await sendTelegramMessage(
      env.telegramBotToken,
      env.telegramChatId,
      `<b>❌ Keka Clock-Out Failed</b>\n\nError: ${result.error}`
    );

    return res.status(500).json({ status: "error", error: result.error });

  } catch (error) {
    console.error(`[Keka] Unhandled error: ${error.message}`);
    return res.status(500).json({ status: "error", error: error.message });
  }
};
