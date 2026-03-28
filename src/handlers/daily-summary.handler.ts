import { IntentType, type IntentHandler } from "../core/types.js";
import { startOfDayInTz, endOfDayInTz, todayInTz } from "../core/date-utils.js";
import { formatEventList } from "./_utils.js";

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

    const eventList = formatEventList(events, tz);

    const response = await ai.generateResponse(
      `[SYSTEM: calendar check] ${dateStr}, ${events.length} event(s):\n${eventList}`,
      aiContext,
    );

    return { responseText: response, events };
  },
};

