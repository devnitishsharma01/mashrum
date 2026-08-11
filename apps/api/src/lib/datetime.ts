/** Convert a wall-clock datetime in a timezone to a UTC Date. */
export function zonedDateTimeToUtc(
  dateStr: string,
  time: string,
  timeZone: string,
): Date {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const [h, m, s] = time.split(":").map(Number);
  const desiredAsUtc = Date.UTC(Y, M - 1, D, h, m || 0, s || 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let utc = desiredAsUtc;
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utc)).map((p) => [p.type, p.value]),
    );
    const shownAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    utc += desiredAsUtc - shownAsUtc;
  }
  return new Date(utc);
}

export function getZonedDateString(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getZonedDayBounds(timeZone: string, date = new Date()) {
  const dateStr = getZonedDateString(timeZone, date);
  return {
    dateStr,
    start: zonedDateTimeToUtc(dateStr, "00:00:00", timeZone),
    end: zonedDateTimeToUtc(dateStr, "23:59:59", timeZone),
  };
}

export function getRangeBounds(
  timeZone: string,
  from?: string,
  to?: string,
) {
  const today = getZonedDateString(timeZone);
  const fromStr = from || today;
  const toStr = to || today;
  return {
    from: fromStr,
    to: toStr,
    start: zonedDateTimeToUtc(fromStr, "00:00:00", timeZone),
    end: zonedDateTimeToUtc(toStr, "23:59:59", timeZone),
  };
}
