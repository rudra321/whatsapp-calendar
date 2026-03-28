import type { CalendarEvent } from "../core/types.js";

/** Format a Date as "02:30 PM" in the given timezone. */
export function formatTime(date: Date, tz?: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
}

/**
 * Find the best-matching event by title.
 * Tries exact substring match first, then falls back to word-based scoring.
 */
export function fuzzyMatchEvent(events: CalendarEvent[], query: string): CalendarEvent | null {
  const q = query.toLowerCase();

  const exact = events.find((e) => e.title.toLowerCase().includes(q));
  if (exact) return exact;

  const stopWords = new Set(["at", "the", "a", "an", "in", "on", "for", "to", "my", "is", "pm", "am", "with"]);
  const queryWords = q.split(/\s+/).filter((w) => w.length > 1 && !stopWords.has(w));
  if (queryWords.length === 0) return null;

  let bestMatch: CalendarEvent | null = null;
  let bestScore = 0;

  for (const event of events) {
    const title = event.title.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (title.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = event;
    }
  }

  return bestMatch;
}

/** Format an event list for AI context. Uses bullet style by default. */
export function formatEventList(events: CalendarEvent[], tz: string, bullet = "•"): string {
  return events
    .map((e) => {
      const time = e.isAllDay
        ? "All day"
        : `${formatTime(e.startTime, tz)} - ${formatTime(e.endTime, tz)}`;
      const details = [e.title];
      if (e.location) details.push(`at ${e.location}`);
      if (e.attendees?.length) details.push(`with ${e.attendees.join(", ")}`);
      if (e.meetLink) details.push(`meet: ${e.meetLink}`);
      return `${bullet} ${time} — ${details.join(" | ")}`;
    })
    .join("\n");
}
