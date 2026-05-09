import { getEnv } from "../src/config.js";
import { clockOut } from "../src/keka.js";
import { sendTelegramMessage } from "../src/telegram.js";
import { isWeekend, getRandomDelaySeconds, sleep, createResponse } from "../src/utils.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(request) {
  try {
    const env = getEnv();

    if (isWeekend()) {
      const message = "[Keka Clock-Out] Skipped — today is a weekend.";
      console.log(message);
      return createResponse(200, { status: "skipped", reason: "weekend" });
    }

    const delay = getRandomDelaySeconds(5);
    if (delay > 0) {
      console.log(`[Keka] Waiting ${delay}s before clock-out (random delay).`);
      await sleep(delay);
    }

    const result = await clockOut(env.kekaToken);

    if (result.success) {
      const msg = "<b>✅ Keka Clock-Out Successful</b>\n\n" +
        `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n` +
        `Date: ${new Date().toLocaleDateString("en-IN")}`;

      await sendTelegramMessage(env.telegramBotToken, env.telegramChatId, msg);

      return createResponse(200, { status: "success" });
    }

    await sendTelegramMessage(
      env.telegramBotToken,
      env.telegramChatId,
      `<b>❌ Keka Clock-Out Failed</b>\n\nError: ${result.error}`
    );

    return createResponse(500, { status: "error", error: result.error });

  } catch (error) {
    console.error(`[Keka] Unhandled error: ${error.message}`);
    return createResponse(500, { status: "error", error: error.message });
  }
}
