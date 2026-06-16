const { getEnv } = require("../src/config.js");
const { getToken, getClientIdFromToken, isTokenExpired, refreshAccessToken } = require("../src/auth.js");
const { submitAttendance } = require("../src/keka.js");
const { sendTelegramMessage } = require("../src/telegram.js");

module.exports = async function handler(req, res) {
  const startTime = Date.now();

  try {
    const env = getEnv();

    console.log("[Test] Manual clock-in triggered.");

    const kekaToken = process.env.KEKA_TOKEN || '';
    const refreshToken = process.env.KEKA_REFRESH_TOKEN || '';
    const clientId = getClientIdFromToken(kekaToken);
    const debug = {
      client_id_derived: clientId,
      token_expired: isTokenExpired(kekaToken),
      has_refresh_token: !!refreshToken,
      keka_token_prefix: kekaToken.substring(0, 20) + '...',
      refresh_token_prefix: refreshToken.substring(0, 20) + '...',
    };

    // Direct refresh attempt to see the actual error
    if (refreshToken && clientId) {
      try {
        const result = await refreshAccessToken(refreshToken, clientId, null);
        debug.direct_refresh = 'success';
      } catch (e) {
        debug.direct_refresh = 'failed';
        debug.direct_refresh_error = e.message;
      }
    } else {
      debug.direct_refresh = 'skipped (missing refreshToken or clientId)';
    }

    // getToken attempts refresh internally
    try {
      const fresh = await getToken(env);
      debug.getToken_result = 'success';
    } catch (e) {
      debug.getToken_result = 'error';
      debug.getToken_error = e.message;
    }

    const result = await submitAttendance(env.kekaToken, 0);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result.success) {
      const msg =
        "<b>🧪 Test Clock-In Successful</b>\n\n" +
        `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n` +
        `Duration: ${elapsed}s`;

      await sendTelegramMessage(env.telegramBotToken, env.telegramChatId, msg);

      return res.status(200).json({
        status: "success",
        duration_seconds: parseFloat(elapsed),
        timestamp: new Date().toISOString(),
        debug,
      });
    }

    return res.status(200).json({
      status: "error",
      error: result.error,
      duration_seconds: parseFloat(elapsed),
      debug,
    });

  } catch (error) {
    console.error(`[Test] Unhandled error: ${error.message}`);
    return res.status(200).json({
      status: "error",
      error: error.message,
      duration_seconds: ((Date.now() - startTime) / 1000).toFixed(2),
      debug: { caught_at: 'handler_top' },
    });
  }
};
