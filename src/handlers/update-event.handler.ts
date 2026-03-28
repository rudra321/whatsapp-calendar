import { IntentType, type IntentHandler, type CalendarEventUpdate } from "../core/types.js";
import { parseDateTimeInTz } from "../core/date-utils.js";
import { formatTime, fuzzyMatchEvent } from "./_utils.js";

export const updateEventHandler: IntentHandler = {
  intentType: IntentType.UPDATE_EVENT,

  async execute({ intent, ports, aiContext }) {
    const { calendar, ai, logger } = ports;
    const params = intent.parameters as {
      searchQuery?: string;
      updates?: {
        title?: string;
        date?: string;
        startTime?: string;
        endTime?: string;
        location?: string;
      };
    };

    if (!params.searchQuery) {
      return { responseText: "Which event would you like to update?" };
    }

    // Search for the event
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const events = await calendar.listEvents({
      startDate: now,
      endDate: twoWeeksLater,
    });

    const query = params.searchQuery.toLowerCase();
    const match = fuzzyMatchEvent(events, query);

    if (!match) {
      return {
        responseText: `I couldn't find an event matching "${params.searchQuery}".`,
      };
    }

    const update: CalendarEventUpdate = {};
    if (params.updates?.title) update.title = params.updates.title;
    if (params.updates?.location) update.location = params.updates.location;
    const tz = aiContext.timezone;
    if (params.updates?.date && params.updates?.startTime) {
      const start = parseDateTimeInTz(params.updates.date, params.updates.startTime, tz);
      update.startTime = start;

      if (params.updates.endTime) {
        update.endTime = parseDateTimeInTz(params.updates.date, params.updates.endTime, tz);
      } else {
        update.endTime = new Date(start.getTime() + 60 * 60 * 1000);
      }
    }

    const updated = await calendar.updateEvent(match.id, update);
    logger.info("Event updated", { eventId: updated.id, title: updated.title });

    const response = await ai.generateResponse(
      `[SYSTEM: event updated] "${updated.title}" → ${updated.startTime.toLocaleDateString("en-US", { timeZone: tz })}, ${formatTime(updated.startTime, tz)} - ${formatTime(updated.endTime, tz)}${updated.location ? `, at ${updated.location}` : ""}`,
      aiContext,
    );

    return { responseText: response, events: [updated] };
  },
};

