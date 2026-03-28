import { IntentType, type IntentHandler, type CalendarEventInput } from "../core/types.js";
import { CalendarConflictError } from "../core/errors.js";
import { parseDateTimeInTz } from "../core/date-utils.js";

export const createEventHandler: IntentHandler = {
  intentType: IntentType.CREATE_EVENT,

  async execute({ intent, ports, aiContext }) {
    const { calendar, ai, logger } = ports;
    const params = intent.parameters as {
      title?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      location?: string;
      description?: string;
      force?: boolean;
      attendees?: string[];
    };

    if (!params.title || !params.date || !params.startTime) {
      return {
        responseText:
          "I need a title, date, and time to create an event. " +
          'e.g. "Meeting with Rahul tomorrow at 2pm"',
      };
    }

    const tz = aiContext.timezone;
    const startTime = parseDateTimeInTz(params.date, params.startTime, tz);
    const endTime = params.endTime
      ? parseDateTimeInTz(params.date, params.endTime, tz)
      : new Date(startTime.getTime() + 60 * 60 * 1000); // default 1 hour

    // Guard against invalid dates
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || endTime <= startTime) {
      return {
        responseText: "Couldn't parse that date/time. Try something like \"Meeting tomorrow at 3pm\".",
      };
    }

    // Check for conflicts (skip if user confirmed with force)
    const conflicts = params.force ? [] : await calendar.checkConflicts({ startTime, endTime });
    if (conflicts.length > 0) {
      const conflictList = conflicts
        .map((e) => `• ${e.title} (${formatTime(e.startTime, tz)} - ${formatTime(e.endTime, tz)})`)
        .join("\n");

      logger.warn("Calendar conflict detected", {
        title: params.title,
        conflicts: conflicts.map((e) => e.title),
      });

      const response = await ai.generateResponse(
        `[SYSTEM: conflict detected] User wants "${params.title}" at ${formatTime(startTime, tz)}-${formatTime(endTime, tz)}. Existing events at that time:\n${conflictList}`,
        aiContext,
      );

      return { responseText: response };
    }

    // Only pass valid email addresses as attendees; names go into title/description
    const validEmails = (params.attendees ?? []).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));

    const input: CalendarEventInput = {
      title: params.title,
      description: params.description,
      startTime,
      endTime,
      location: params.location,
      isAllDay: false,
      reminders: [15],
      attendees: validEmails.length ? validEmails : undefined,
    };

    const event = await calendar.createEvent(input);
    logger.info("Event created", { eventId: event.id, title: event.title });

    const facts = [
      `[SYSTEM: event created]`,
      `title: ${event.title}`,
      `when: ${event.startTime.toLocaleDateString("en-US", { timeZone: tz })}, ${formatTime(event.startTime, tz)} - ${formatTime(event.endTime, tz)}`,
      event.location ? `where: ${event.location}` : null,
      event.meetLink ? `meet link: ${event.meetLink}` : null,
      params.attendees?.length ? `invited: ${params.attendees.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const response = await ai.generateResponse(facts, aiContext);

    return { responseText: response, events: [event] };
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
