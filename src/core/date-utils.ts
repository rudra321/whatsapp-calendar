/**
 * Timezone-aware date utilities.
 * All functions convert "local time in a timezone" to correct UTC Date objects.
 */

/**
 * Parse a date + time string as a specific timezone, returning the correct UTC Date.
 * e.g. parseDateTimeInTz("2026-02-28", "21:00", "Asia/Kolkata")
 *   → Date representing 21:00 IST = 15:30 UTC
 */
export function parseDateTimeInTz(dateStr: string, timeStr: string, timezone: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fakeUtc = new Date(`${dateStr}T${pad(hours)}:${pad(minutes)}:00Z`);
  const offsetMs = getTimezoneOffsetMs(fakeUtc, timezone);
  return new Date(fakeUtc.getTime() - offsetMs);
}

/**
 * Get start of day (00:00:00.000) in a timezone as a UTC Date.
 */
export function startOfDayInTz(dateStr: string, timezone: string): Date {
  const date = parseDateTimeInTz(dateStr, "00:00", timezone);
  return date;
}

/**
 * Get end of day (23:59:59.999) in a timezone as a UTC Date.
 */
export function endOfDayInTz(dateStr: string, timezone: string): Date {
  const date = parseDateTimeInTz(dateStr, "23:59", timezone);
  // Add 59 seconds and 999 ms
  return new Date(date.getTime() + 59 * 1000 + 999);
}

/**
 * Get today's date string (YYYY-MM-DD) in a timezone.
 */
export function todayInTz(timezone: string): string {
  // en-CA locale formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

/**
 * Get the timezone offset in milliseconds (positive = ahead of UTC).
 */
function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => {
    const val = parts.find((p) => p.type === type)?.value ?? "0";
    return parseInt(val === "24" ? "0" : val, 10);
  };

  const tzMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const utcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

  return tzMs - utcMs;
}
