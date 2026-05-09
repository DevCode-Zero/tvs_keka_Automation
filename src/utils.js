function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function getRandomDelaySeconds(maxMinutes = 5) {
  const maxSeconds = maxMinutes * 60;
  return Math.floor(Math.random() * maxSeconds);
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

module.exports = { isWeekend, getCurrentTimestamp, getRandomDelaySeconds, sleep };
