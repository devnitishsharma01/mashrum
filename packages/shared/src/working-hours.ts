import type { WorkingHours } from "./schemas/business";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    weekday: map.weekday,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function weekdayKey(weekday: string): keyof WorkingHours {
  const lookup: Record<string, keyof WorkingHours> = {
    Sun: "sunday",
    Mon: "monday",
    Tue: "tuesday",
    Wed: "wednesday",
    Thu: "thursday",
    Fri: "friday",
    Sat: "saturday",
  };
  return lookup[weekday] || "monday";
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isBusinessOpen(
  workingHours: WorkingHours,
  timeZone: string,
  now = new Date(),
): { open: boolean; reason?: string } {
  const { weekday, hour, minute } = zonedParts(now, timeZone);
  const key = weekdayKey(weekday);
  const day = workingHours[key];
  if (!day || day.closed) {
    return { open: false, reason: `We are closed on ${key}.` };
  }
  const current = hour * 60 + minute;
  const openAt = toMinutes(day.open);
  const closeAt = toMinutes(day.close);
  if (current < openAt || current > closeAt) {
    return {
      open: false,
      reason: `We are closed right now. Hours today: ${day.open} - ${day.close}.`,
    };
  }
  return { open: true };
}

export { DAY_KEYS };
