import { getEnv } from "../src/config.js";
import { clockOut } from "../src/keka.js";
import { sendTelegramMessage } from "../src/telegram.js";
import { createResponse } from "../src/utils.js";

export const config = {
  runtime: "nodejs18.x",
};

export default async function handler(request) {
  const startTime = Date.now();

  try {
    const env = getEnv();

    console.log("[Test] Manual clock-out triggered.");

    const result = await clockOut(env.kekaToken);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result.success) {
      const msg = "<b>🧪 Test Clock-Out Successful</b>\n\n" +
        `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n` +
        `Duration: ${elapsed}s`;

      await sendTelegramMessage(env.telegramBotToken, env.telegramChatId, msg);

      return createResponse(200, {
        status: "success",
        duration_seconds: parseFloat(elapsed),
        timestamp: new Date().toISOString(),
      });
    }

    return createResponse(500, {
      status: "error",
      error: result.error,
      duration_seconds: parseFloat(elapsed),
    });

  } catch (error) {
    console.error(`[Test] Unhandled error: ${error.message}`);
    return createResponse(500, {
      status: "error",
      error: error.message,
      duration_seconds: ((Date.now() - startTime) / 1000).toFixed(2),
    });
  }
}
