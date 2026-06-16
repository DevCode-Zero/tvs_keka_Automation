const TOKEN_URL = "https://app.keka.com/connect/token";
const SCOPE = "kekaapi offline_access";

let cachedToken = null;
let cachedTokenExpiry = 0;

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    return payload;
  } catch {
    return null;
  }
}

function getClientIdFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (payload && payload.client_id) return payload.client_id;
  return null;
}

function getTokenExpiry(token) {
  const payload = decodeJwtPayload(token);
  if (payload && payload.exp) return payload.exp * 1000;
  return 0;
}

function isTokenExpired(token) {
  const exp = getTokenExpiry(token);
  if (!exp) return false;
  return Date.now() >= exp - 60000;
}

async function loginWithPassword(username, password, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
    scope: SCOPE,
    client_id: clientId,
  });

  if (clientSecret) {
    body.append("client_secret", clientSecret);
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Auth failed (${response.status}): ${text.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || 86400,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
  };
}

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  if (clientSecret) {
    body.append("client_secret", clientSecret);
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 86400,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
  };
}

async function getToken(config) {
  if (cachedToken && !isTokenExpired(cachedToken)) {
    return cachedToken;
  }

  const clientId =
    config.kekaClientId ||
    (config.kekaToken ? getClientIdFromToken(config.kekaToken) : null);
  const clientSecret = config.kekaClientSecret;

  // 1. Try refresh token first (if KEKA_TOKEN is expired but we have a refresh token)
  if (config.kekaRefreshToken && config.kekaToken && isTokenExpired(config.kekaToken)) {
    try {
      const auth = await refreshAccessToken(
        config.kekaRefreshToken,
        clientId,
        clientSecret
      );
      cachedToken = auth.accessToken;
      cachedTokenExpiry = auth.expiresAt;
      return cachedToken;
    } catch (refreshError) {
      console.error(`[Auth] Refresh token failed: ${refreshError.message}`);
      // refresh failed, fall through
    }
  }

  // 2. Try password grant
  if (config.kekaUsername && config.kekaPassword && (config.kekaClientId || clientId)) {
    const auth = await loginWithPassword(
      config.kekaUsername,
      config.kekaPassword,
      config.kekaClientId || clientId,
      clientSecret
    );
    cachedToken = auth.accessToken;
    cachedTokenExpiry = auth.expiresAt;
    return cachedToken;
  }

  // 3. Use the token as-is (may still be valid)
  if (config.kekaToken) {
    if (!isTokenExpired(config.kekaToken)) {
      cachedToken = config.kekaToken;
      return cachedToken;
    }
    throw new Error("KEKA_TOKEN has expired. Set KEKA_REFRESH_TOKEN to enable auto-refresh.");
  }

  throw new Error(
    "No credentials configured. Set KEKA_TOKEN, or KEKA_REFRESH_TOKEN, or KEKA_USERNAME + KEKA_PASSWORD + KEKA_CLIENT_ID."
  );
}

function clearCache() {
  cachedToken = null;
  cachedTokenExpiry = 0;
}

module.exports = {
  getToken,
  loginWithPassword,
  refreshAccessToken,
  getTokenExpiry,
  isTokenExpired,
  getClientIdFromToken,
  clearCache,
};
