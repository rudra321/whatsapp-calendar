// ─── Intent Types ───────────────────────────────────────────────
export enum IntentType {
  CREATE_EVENT = "create_event",
  UPDATE_EVENT = "update_event",
  DELETE_EVENT = "delete_event",
  LIST_EVENTS = "list_events",
  DAILY_SUMMARY = "daily_summary",
  UNKNOWN = "unknown",
}

// ─── Calendar ───────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay: boolean;
  reminders?: number[]; // minutes before event
  meetLink?: string;
  attendees?: string[];
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay?: boolean;
  reminders?: number[];
  attendees?: string[];
}

export interface CalendarEventUpdate {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  isAllDay?: boolean;
  reminders?: number[];
}

export interface CalendarQuery {
  startDate: Date;
  endDate: Date;
  maxResults?: number;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

// ─── Messaging ──────────────────────────────────────────────────
export interface IncomingMessage {
  id: string;
  from: string;
  text: string;
  timestamp: Date;
  raw?: unknown;
}

export interface OutgoingMessage {
  to: string;
  text: string;
}

// ─── AI ─────────────────────────────────────────────────────────
export interface ParsedIntent {
  type: IntentType;
  confidence: number;
  parameters: Record<string, unknown>;
  rawText: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIContext {
  timezone: string;
  currentDate: string;
  recentEvents?: CalendarEvent[];
  conversationHistory?: ConversationMessage[];
}

// ─── Handlers ───────────────────────────────────────────────────
export interface HandlerResult {
  responseText: string;
  events?: CalendarEvent[];
}

export interface HandlerExecutionContext {
  intent: ParsedIntent;
  message: IncomingMessage;
  ports: HandlerPorts;
  aiContext: AIContext;
}

export interface HandlerPorts {
  calendar: import("../ports/calendar-provider.port.js").CalendarProviderPort;
  ai: import("../ports/ai-provider.port.js").AIProviderPort;
  logger: import("../ports/logger.port.js").LoggerPort;
}

export interface IntentHandler {
  intentType: IntentType;
  execute(context: HandlerExecutionContext): Promise<HandlerResult>;
}

// ─── Notifications ──────────────────────────────────────────────
export interface Notification {
  userId: string;
  title: string;
  body: string;
  event?: CalendarEvent;
}

// ─── Domain Events ──────────────────────────────────────────────
export enum DomainEventType {
  MESSAGE_RECEIVED = "message.received",
  INTENT_PARSED = "intent.parsed",
  EVENT_CREATED = "event.created",
  EVENT_UPDATED = "event.updated",
  EVENT_DELETED = "event.deleted",
  EVENTS_LISTED = "events.listed",
  REPLY_SENT = "reply.sent",
  ERROR_OCCURRED = "error.occurred",
}

export interface DomainEventPayloads {
  [DomainEventType.MESSAGE_RECEIVED]: { message: IncomingMessage };
  [DomainEventType.INTENT_PARSED]: { intent: ParsedIntent; message: IncomingMessage };
  [DomainEventType.EVENT_CREATED]: { event: CalendarEvent };
  [DomainEventType.EVENT_UPDATED]: { event: CalendarEvent };
  [DomainEventType.EVENT_DELETED]: { eventId: string };
  [DomainEventType.EVENTS_LISTED]: { events: CalendarEvent[]; query: CalendarQuery };
  [DomainEventType.REPLY_SENT]: { to: string; text: string };
  [DomainEventType.ERROR_OCCURRED]: { error: Error; context?: string };
}
