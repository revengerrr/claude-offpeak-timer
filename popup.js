// Claude Off-Peak Timer — Popup Logic

const PEAK_START_ET = 8;   // 8 AM ET
const PEAK_END_ET = 14;    // 2 PM ET
const PROMO_START = new Date('2026-03-13T00:00:00-05:00');
const PROMO_END = new Date('2026-03-27T23:59:59-08:00');

// ── Timezone Helpers ──
function toET(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function getETHour(date) {
  return parseInt(date.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }), 10);
}

function getETWeekday(date) {
  return date.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long' });
}

function isWeekdayET(date) {
  const day = getETWeekday(date);
  return !['Saturday', 'Sunday'].includes(day);
}

function isPeak(date) {
  const h = getETHour(date);
  return isWeekdayET(date) && h >= PEAK_START_ET && h < PEAK_END_ET;
}

function isPromoActive(date) {
  return date >= PROMO_START && date <= PROMO_END;
}

// ── Convert ET hour to local time string ──
function etHourToLocal(etHour) {
  // Create a date in ET, then display in local tz
  const now = new Date();
  const etNow = toET(now);
  const diff = etHour - etNow.getHours();
  const local = new Date(now.getTime() + diff * 3600000);
  return local.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Time until next transition ──
function getNextTransition(now) {
  const etNow = toET(now);
  const h = etNow.getHours();
  const m = etNow.getMinutes();
  const s = etNow.getSeconds();
  const currentMs = ((h * 60 + m) * 60 + s) * 1000;
  const weekday = isWeekdayET(now);

  if (isPeak(now)) {
    // Currently peak → next off-peak at 2 PM ET today
    const targetMs = PEAK_END_ET * 3600000;
    return { ms: targetMs - currentMs, label: 'Off-peak starts in', toOffpeak: true };
  }

  if (weekday && h < PEAK_START_ET) {
    // Before peak today
    const targetMs = PEAK_START_ET * 3600000;
    return { ms: targetMs - currentMs, label: 'Peak starts in', toOffpeak: false };
  }

  // After peak or weekend → find next peak
  const etDay = getETWeekday(now);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIdx = dayNames.indexOf(etDay);

  let daysUntilWeekday = 0;
  if (weekday && h >= PEAK_END_ET) {
    daysUntilWeekday = 1; // next day
    let nextDayIdx = (dayIdx + 1) % 7;
    if (nextDayIdx === 0) daysUntilWeekday = 2; // skip Sunday → Monday
    if (nextDayIdx === 6) daysUntilWeekday = 2; // skip Saturday → Monday
  } else if (!weekday) {
    if (dayIdx === 6) daysUntilWeekday = 2; // Sat → Mon
    if (dayIdx === 0) daysUntilWeekday = 1; // Sun → Mon
  }

  const targetMs = PEAK_START_ET * 3600000;
  const msToday = 86400000 - currentMs;
  const msFutureDays = (daysUntilWeekday - 1) * 86400000;
  return { ms: msToday + msFutureDays + targetMs, label: 'Next peak in', toOffpeak: false };
}

// ── Format milliseconds ──
function formatMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0')
  };
}

// ── Build Schedule ──
function buildSchedule() {
  const grid = document.getElementById('scheduleGrid');
  const now = new Date();
  const etDayName = getETWeekday(now);

  const peakLocalStart = etHourToLocal(PEAK_START_ET);
  const peakLocalEnd = etHourToLocal(PEAK_END_ET);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  grid.innerHTML = '';

  days.forEach((day, i) => {
    const row = document.createElement('div');
    row.className = 'schedule-row';

    const isToday = fullDays[i] === etDayName;
    if (isToday) row.classList.add('today');

    const isWeekend = i >= 5;
    if (isWeekend) row.classList.add('weekend');

    const dayEl = document.createElement('span');
    dayEl.className = 'schedule-day';
    dayEl.textContent = isToday ? `${day} ←` : day;

    row.appendChild(dayEl);

    if (isWeekend) {
      const badge = document.createElement('span');
      badge.className = 'schedule-badge';
      badge.textContent = 'ALL DAY 2×';
      row.appendChild(badge);
    } else {
      const peakEl = document.createElement('span');
      peakEl.className = 'schedule-peak';
      peakEl.textContent = `⚠ ${peakLocalStart}–${peakLocalEnd}`;
      row.appendChild(peakEl);

      const badge = document.createElement('span');
      badge.className = 'schedule-badge';
      badge.textContent = '2× outside';
      row.appendChild(badge);
    }

    grid.appendChild(row);
  });

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('tzInfo').textContent = `Detected timezone: ${tz}`;
}

// ── Promo Progress ──
function updatePromoProgress(now) {
  const total = PROMO_END.getTime() - PROMO_START.getTime();
  const elapsed = now.getTime() - PROMO_START.getTime();
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const remaining = Math.max(0, Math.ceil((PROMO_END.getTime() - now.getTime()) / 86400000));

  document.getElementById('remainingFill').style.width = pct + '%';
  document.getElementById('remainingText').textContent =
    remaining > 0 ? `${remaining} days remaining in promotion` : 'Promotion has ended';
}

// ── Promo Badge ──
function updatePromoBadge(now) {
  const badge = document.getElementById('promoBadge');
  if (!isPromoActive(now)) {
    badge.textContent = 'PROMO ENDED';
    badge.classList.add('expired');
  }
}

// ── Main Update Loop ──
function update() {
  const now = new Date();
  const peak = isPeak(now);
  const card = document.getElementById('statusCard');

  // Status card
  card.className = 'status-card ' + (peak ? 'peak' : 'offpeak');
  document.getElementById('statusLabel').textContent = peak ? 'PEAK HOURS' : 'OFF-PEAK';
  document.getElementById('statusDetail').textContent = peak
    ? 'Standard usage limits active'
    : '2× usage active now';
  document.getElementById('multiplier').textContent = peak ? '1×' : '2×';

  // Countdown
  const trans = getNextTransition(now);
  document.getElementById('countdownLabel').textContent = trans.label;
  const t = formatMs(trans.ms);
  document.getElementById('hours').textContent = t.hours;
  document.getElementById('minutes').textContent = t.minutes;
  document.getElementById('seconds').textContent = t.seconds;

  // Promo
  updatePromoProgress(now);
  updatePromoBadge(now);
}

// ── Notification Toggle ──
async function initSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const { notificationsEnabled } = await chrome.storage.local.get('notificationsEnabled');
    document.getElementById('notifToggle').checked = notificationsEnabled !== false;

    document.getElementById('notifToggle').addEventListener('change', (e) => {
      chrome.storage.local.set({ notificationsEnabled: e.target.checked });
    });
  }
}

// ── Open Claude Link ──
document.getElementById('openClaude').addEventListener('click', (e) => {
  e.preventDefault();
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url: 'https://claude.ai' });
  } else {
    window.open('https://claude.ai', '_blank');
  }
});

// ── Init ──
buildSchedule();
update();
setInterval(update, 1000);
initSettings();
