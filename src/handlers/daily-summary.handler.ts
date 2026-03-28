import { IntentType, type IntentHandler } from "../core/types.js";
import { startOfDayInTz, endOfDayInTz, todayInTz } from "../core/date-utils.js";

export const dailySummaryHandler: IntentHandler = {
  intentType: IntentType.DAILY_SUMMARY,

  async execute({ intent, ports, aiContext }) {
    const { calendar, ai, logger } = ports;
    const tz = aiContext.timezone;
    const params = intent.parameters as { date?: string };

    const dateString = params.date ?? todayInTz(tz);
    const startDate = startOfDayInTz(dateString, tz);
    const endDate = endOfDayInTz(dateString, tz);

    const events = await calendar.listEvents({ startDate, endDate });
    logger.info("Daily summary generated", { date: startDate.toISOString(), count: events.length });

    const dateStr = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });

    if (events.length === 0) {
      const response = await ai.generateResponse(
        `[SYSTEM: calendar check] ${dateStr} — no events`,
        aiContext,
      );
      return { responseText: response };
    }

    const eventList = events
      .map((e) => {
        const time = e.isAllDay
          ? "All day"
          : `${formatTime(e.startTime, tz)} - ${formatTime(e.endTime, tz)}`;
        const details = [e.title];
        if (e.location) details.push(`at ${e.location}`);
        if (e.attendees?.length) details.push(`with ${e.attendees.join(", ")}`);
        if (e.meetLink) details.push(`meet: ${e.meetLink}`);
        return `${time}: ${details.join(" | ")}`;
      })
      .join("\n");

    const response = await ai.generateResponse(
      `[SYSTEM: calendar check] ${dateStr}, ${events.length} event(s):\n${eventList}`,
      aiContext,
    );

    return { responseText: response, events };
  },
};

function formatTime(date: Date, tz?: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
}
