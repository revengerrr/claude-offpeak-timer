// Claude Off-Peak Timer — Background Service Worker

const PEAK_START_HOUR_ET = 8;  // 8 AM ET
const PEAK_END_HOUR_ET = 14;   // 2 PM ET (exclusive)
const PROMO_START = new Date('2026-03-13T00:00:00-05:00').getTime();
const PROMO_END = new Date('2026-03-27T23:59:59-08:00').getTime();

function getETHour(date) {
  const etString = date.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
  return parseInt(etString, 10);
}

function getETDay(date) {
  const etString = date.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long' });
  return etString;
}

function isWeekdayET(date) {
  const day = getETDay(date);
  return !['Saturday', 'Sunday'].includes(day);
}

function isPeakNow() {
  const now = new Date();
  const hour = getETHour(now);
  const weekday = isWeekdayET(now);
  return weekday && hour >= PEAK_START_HOUR_ET && hour < PEAK_END_HOUR_ET;
}

function isPromoActive() {
  const now = Date.now();
  return now >= PROMO_START && now <= PROMO_END;
}

// Calculate next off-peak transition in ms
function getNextOffPeakMs() {
  const now = new Date();
  if (!isPeakNow()) return 0; // Already off-peak

  // Next off-peak is 2 PM ET today
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const target = new Date(etNow);
  target.setHours(PEAK_END_HOUR_ET, 0, 0, 0);

  // Convert back: get the difference
  const diffMs = target.getTime() - etNow.getTime();
  return Math.max(0, diffMs);
}

// Set up periodic alarm to check and notify
chrome.alarms.create('offpeak-check', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'offpeak-check') return;

  const { notificationsEnabled } = await chrome.storage.local.get('notificationsEnabled');
  if (!notificationsEnabled) return;
  if (!isPromoActive()) return;

  const now = new Date();
  const hour = getETHour(now);
  const minute = now.getMinutes();

  // Notify at the start of off-peak (2 PM ET on weekdays, or all day weekends)
  if (isWeekdayET(now) && hour === PEAK_END_HOUR_ET && minute === 0) {
    chrome.notifications.create('offpeak-start', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⚡ Claude Off-Peak Started!',
      message: '2x usage is now active! Make the most of your doubled limits.',
      priority: 2
    });
  }

  // Notify 5 min before peak starts (7:55 AM ET on weekdays)
  if (isWeekdayET(now) && hour === (PEAK_START_HOUR_ET - 1) && minute === 55) {
    chrome.notifications.create('peak-warning', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⏰ Peak Hours in 5 Minutes',
      message: 'Claude usage returns to normal at 8 AM ET. Wrap up your 2x sessions!',
      priority: 1
    });
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://claude.ai' });
});

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ notificationsEnabled: true });
});
