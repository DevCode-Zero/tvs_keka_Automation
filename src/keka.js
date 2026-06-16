const { getCurrentTimestamp } = require("./utils.js");
const { getToken, clearCache } = require("./auth.js");
const { getEnv } = require("./config.js");

const KEKA_URL =
  "https://tvsnext.keka.com/k/attendance/api/mytime/attendance/webclockin";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

async function submitAttendance(existingToken, punchStatus) {
  let kekaToken;
  try {
    kekaToken = await getToken(getEnv());
  } catch {
    kekaToken = existingToken;
  }
  if (!kekaToken) {
    try {
      kekaToken = await getToken(getEnv());
    } catch {}
  }

  const payload = {
    timestamp: getCurrentTimestamp(),
    attendanceLogSource: 1,
    locationAddress: null,
    manualClockinType: 1,
    note: "",
    originalPunchStatus: punchStatus,
  };

  const label = punchStatus === 0 ? "Clock-In" : "Clock-Out";

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      console.log(
        `[Keka] Attempt ${attempt}/${MAX_RETRIES} — sending ${label} request...`
      );

      const response = await fetch(KEKA_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kekaToken}`,
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${responseBody.slice(0, 500)}`
        );
      }

      console.log(`[Keka] ${label} successful on attempt ${attempt}.`);
      return { success: true, data: responseBody };

    } catch (error) {
      lastError = error;
      const isTimeout = error.name === "AbortError";

      if (
        !isTimeout &&
        attempt < MAX_RETRIES &&
        (error.message.includes("HTTP 401") ||
         error.message.includes("HTTP 403"))
      ) {
        console.log(`[Keka] Token rejected on attempt ${attempt}, refreshing...`);
        clearCache();
        try {
          kekaToken = await getToken(getEnv());
          console.log("[Keka] Token refreshed, retrying...");
        } catch (refreshError) {
          console.error(`[Keka] Token refresh failed: ${refreshError.message}`);
        }
      }

      console.error(
        `[Keka] Attempt ${attempt} failed — ${
          isTimeout ? "Request timed out" : error.message
        }`
      );

      if (attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`[Keka] Retrying in ${backoff / 1000}s...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  console.error(`[Keka] All ${MAX_RETRIES} attempts failed.`);
  return { success: false, error: lastError.message };
}

module.exports = { submitAttendance };
