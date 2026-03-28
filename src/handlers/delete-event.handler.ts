import { IntentType, type IntentHandler } from "../core/types.js";
import { startOfDayInTz, endOfDayInTz } from "../core/date-utils.js";
import { formatTime, fuzzyMatchEvent } from "./_utils.js";

export const deleteEventHandler: IntentHandler = {
  intentType: IntentType.DELETE_EVENT,

  async execute({ intent, ports, aiContext }) {
    const { calendar, ai, logger } = ports;
    const tz = aiContext.timezone;
    const params = intent.parameters as {
      searchQuery?: string;
      date?: string;
      deleteAll?: boolean;
    };

    // Bulk delete: clear all events for a date
    if (params.deleteAll && params.date) {
      const startDate = startOfDayInTz(params.date, tz);
      const endDate = endOfDayInTz(params.date, tz);

      const events = await calendar.listEvents({ startDate, endDate });

      if (events.length === 0) {
        return {
          responseText: `No events found on ${startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })} to delete.`,
        };
      }

      for (const event of events) {
        await calendar.deleteEvent(event.id);
        logger.info("Event deleted", { eventId: event.id, title: event.title });
      }

      const titles = events.map((e) => `• ${e.title}`).join("\n");
      const response = await ai.generateResponse(
        `[SYSTEM: bulk delete done] Removed ${events.length} event(s) from ${startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz })}:\n${titles}`,
        aiContext,
      );

      return { responseText: response };
    }

    // Single delete by search query
    if (!params.searchQuery && !params.date) {
      return { responseText: "Which event would you like to delete?" };
    }

    // Determine search window
    let startDate: Date;
    let endDate: Date;

    if (params.date) {
      startDate = startOfDayInTz(params.date, tz);
      endDate = endOfDayInTz(params.date, tz);
    } else {
      startDate = new Date();
      endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    const events = await calendar.listEvents({ startDate, endDate });

    // Find the best match using fuzzy word matching
    const query = (params.searchQuery ?? "").toLowerCase();
    const match = fuzzyMatchEvent(events, query);

    if (!match) {
      return {
        responseText: `I couldn't find an event matching "${params.searchQuery ?? params.date}". ` +
          `Try listing your events first to see what's on your calendar.`,
      };
    }

    await calendar.deleteEvent(match.id);
    logger.info("Event deleted", { eventId: match.id, title: match.title });

    const response = await ai.generateResponse(
      `[SYSTEM: event deleted] "${match.title}" — was ${match.startTime.toLocaleDateString("en-US", { timeZone: tz })} at ${formatTime(match.startTime, tz)}`,
      aiContext,
    );

    return { responseText: response };
  },
};

