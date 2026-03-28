import type { CalendarProviderPort } from "../../ports/calendar-provider.port.js";
import type { LoggerPort } from "../../ports/logger.port.js";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventUpdate,
  CalendarQuery,
  TimeSlot,
} from "../../core/types.js";
import { CalendarAuthError } from "../../core/errors.js";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export class GoogleCalendarAdapter implements CalendarProviderPort {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    private readonly timezone: string,
    private readonly logger: LoggerPort,
  ) {}

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const token = await this.getAccessToken();

    const body: any = {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: input.isAllDay
        ? { date: this.toDateString(input.startTime) }
        : { dateTime: input.startTime.toISOString(), timeZone: this.timezone },
      end: input.isAllDay
        ? { date: this.toDateString(input.endTime) }
        : { dateTime: input.endTime.toISOString(), timeZone: this.timezone },
    };

    if (input.reminders?.length) {
      body.reminders = {
        useDefault: false,
        overrides: input.reminders.map((minutes) => ({
          method: "popup",
          minutes,
        })),
      };
    }

    if (input.attendees?.length) {
      body.attendees = input.attendees.map((email) => ({ email }));
    }

    // Auto-attach Google Meet link
    body.conferenceData = {
      createRequest: {
        requestId: `wa-cal-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Calendar create failed: ${err}`);
    }

    return this.mapEvent(await response.json());
  }

  async updateEvent(id: string, input: CalendarEventUpdate): Promise<CalendarEvent> {
    const token = await this.getAccessToken();

    const body: any = {};
    if (input.title !== undefined) body.summary = input.title;
    if (input.description !== undefined) body.description = input.description;
    if (input.location !== undefined) body.location = input.location;
    if (input.startTime !== undefined) {
      body.start = input.isAllDay
        ? { date: this.toDateString(input.startTime) }
        : { dateTime: input.startTime.toISOString(), timeZone: this.timezone };
    }
    if (input.endTime !== undefined) {
      body.end = input.isAllDay
        ? { date: this.toDateString(input.endTime) }
        : { dateTime: input.endTime.toISOString(), timeZone: this.timezone };
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Calendar update failed: ${err}`);
    }

    return this.mapEvent(await response.json());
  }

  async deleteEvent(id: string): Promise<void> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok && response.status !== 410) {
      const err = await response.text();
      throw new Error(`Google Calendar delete failed: ${err}`);
    }
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Calendar get failed: ${err}`);
    }

    return this.mapEvent(await response.json());
  }

  async listEvents(query: CalendarQuery): Promise<CalendarEvent[]> {
    const token = await this.getAccessToken();

    const params = new URLSearchParams({
      timeMin: query.startDate.toISOString(),
      timeMax: query.endDate.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(query.maxResults ?? 50),
    });

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Calendar list failed: ${err}`);
    }

    const data = await response.json() as any;
    return (data.items ?? []).map((item: any) => this.mapEvent(item));
  }

  async checkConflicts(timeSlot: TimeSlot): Promise<CalendarEvent[]> {
    return this.listEvents({
      startDate: timeSlot.startTime,
      endDate: timeSlot.endTime,
    });
  }

  // ─── Private helpers ────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new CalendarAuthError(`Token refresh failed: ${err}`);
    }

    const data = (await response.json()) as any;
    this.accessToken = data.access_token;
    // Refresh 5 minutes before expiry
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    this.logger.debug("Google Calendar token refreshed");

    return this.accessToken!;
  }

  private mapEvent(raw: any): CalendarEvent {
    const isAllDay = !!raw.start?.date;
    return {
      id: raw.id,
      title: raw.summary ?? "(No title)",
      description: raw.description,
      startTime: new Date(raw.start?.dateTime ?? raw.start?.date),
      endTime: new Date(raw.end?.dateTime ?? raw.end?.date),
      location: raw.location,
      isAllDay,
      reminders: raw.reminders?.overrides?.map((r: any) => r.minutes),
      meetLink: raw.hangoutLink ?? raw.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri,
      attendees: raw.attendees?.map((a: any) => a.email).filter(Boolean),
    };
  }

  private toDateString(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
