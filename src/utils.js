export function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

export function getCurrentTimestamp() {
  return new Date().toISOString();
}

export function getRandomDelaySeconds(maxMinutes = 5) {
  const maxSeconds = maxMinutes * 60;
  return Math.floor(Math.random() * maxSeconds);
}

export function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export function createResponse(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
