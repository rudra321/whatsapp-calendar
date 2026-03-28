import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventUpdate,
  CalendarQuery,
  TimeSlot,
} from "../core/types.js";

export interface CalendarProviderPort {
  createEvent(input: CalendarEventInput): Promise<CalendarEvent>;
  updateEvent(id: string, input: CalendarEventUpdate): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;
  getEvent(id: string): Promise<CalendarEvent | null>;
  listEvents(query: CalendarQuery): Promise<CalendarEvent[]>;
  checkConflicts(timeSlot: TimeSlot): Promise<CalendarEvent[]>;
}
