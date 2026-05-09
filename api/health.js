export const config = { runtime: "nodejs" };

export default async function handler() {
  const envVars = {
    KEKA_TOKEN: process.env.KEKA_TOKEN ? "✓ Set" : "✗ Missing",
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? "✓ Set" : "✗ Missing",
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? "✓ Set" : "✗ Missing",
  };

  return new Response(JSON.stringify({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: envVars,
    day: new Date().toLocaleDateString("en-US", { weekday: "long" }),
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

  return createResponse(configValid ? 200 : 503, {
    status: configValid ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    server_time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    environment: envVars,
    day: new Date().toLocaleDateString("en-US", { weekday: "long" }),
    is_weekend: [0, 6].includes(new Date().getDay()),
  });
}
