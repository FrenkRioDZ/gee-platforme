// Same week rules as backend/utils/scheduler.js — keep the two in sync.
// Up to the week ending Wed 21/10/2026 a week runs Thursday → Wednesday;
// then Thu 22/10 → Tue 27/10, then every week runs Wednesday → Tuesday.
const DAY_MS = 86400000;
const LAST_WEDNESDAY_DEADLINE = new Date(2026, 9, 21, 23, 59, 59, 999);

const nextWeekdayEnd = (date, weekday) => {
  const d = new Date(date);
  d.setDate(d.getDate() + (weekday - d.getDay() + 7) % 7);
  d.setHours(23, 59, 59, 999);
  return d;
};

// Deadline (= week end) of the week containing `date`
export const getWeekDeadline = (date = new Date()) => {
  const wednesday = nextWeekdayEnd(date, 3);
  return wednesday <= LAST_WEDNESDAY_DEADLINE ? wednesday : nextWeekdayEnd(date, 2);
};

export const prevWeekEnd = (weekEnd) => getWeekDeadline(new Date(new Date(weekEnd).getTime() - 7 * DAY_MS));
export const nextWeekEnd = (weekEnd) => getWeekDeadline(new Date(new Date(weekEnd).getTime() + DAY_MS));

// First day (00:00) of the week ending at `weekEnd`
export const getWeekStart = (weekEnd) => {
  const start = prevWeekEnd(weekEnd);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  return start;
};
