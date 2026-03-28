import { IntentType, type IntentHandler } from "../core/types.js";
import { startOfDayInTz, endOfDayInTz, todayInTz } from "../core/date-utils.js";
import { formatEventList } from "./_utils.js";

export const listEventsHandler: IntentHandler = {
  intentType: IntentType.LIST_EVENTS,

  async execute({ intent, ports, aiContext }) {
    const { calendar, ai, logger } = ports;
    const tz = aiContext.timezone;
    const params = intent.parameters as {
      date?: string;
      startDate?: string;
      endDate?: string;
    };

    let startDate: Date;
    let endDate: Date;

    if (params.date) {
      startDate = startOfDayInTz(params.date, tz);
      endDate = endOfDayInTz(params.date, tz);
    } else if (params.startDate && params.endDate) {
      startDate = startOfDayInTz(params.startDate, tz);
      endDate = endOfDayInTz(params.endDate, tz);
    } else {
      // Default: today in user's timezone
      const today = todayInTz(tz);
      startDate = startOfDayInTz(today, tz);
      endDate = endOfDayInTz(today, tz);
    }

    const events = await calendar.listEvents({ startDate, endDate });
    logger.info("Events listed", { count: events.length, startDate: startDate.toISOString() });

    const dateStr =
      startDate.toLocaleDateString("en-US", { timeZone: tz }) === endDate.toLocaleDateString("en-US", { timeZone: tz })
        ? startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })
        : `${startDate.toLocaleDateString("en-US", { timeZone: tz })} to ${endDate.toLocaleDateString("en-US", { timeZone: tz })}`;

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

