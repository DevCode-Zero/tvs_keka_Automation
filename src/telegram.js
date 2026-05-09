const TELEGRAM_API = "https://api.telegram.org/bot";

async function sendTelegramMessage(botToken, chatId, message) {
  if (!botToken || !chatId) {
    console.log("[Telegram] Skipping — bot token or chat ID not configured.");
    return { success: false, skipped: true };
  }

  try {
    const url = `${TELEGRAM_API}${botToken}/sendMessage`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error ${response.status}: ${errorText}`);
    }

    console.log("[Telegram] Notification sent successfully.");
    return { success: true };

  } catch (error) {
    console.error(`[Telegram] Failed to send notification: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { sendTelegramMessage };
