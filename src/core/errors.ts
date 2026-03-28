export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class CalendarConflictError extends DomainError {
  constructor(
    message: string,
    public readonly conflictingEvents: string[],
  ) {
    super(message, "CALENDAR_CONFLICT");
    this.name = "CalendarConflictError";
  }
}

export class AIParseError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super(message, "AI_PARSE_ERROR", cause);
    this.name = "AIParseError";
  }
}

export class MessageDeliveryError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super(message, "MESSAGE_DELIVERY_ERROR", cause);
    this.name = "MessageDeliveryError";
  }
}

export class ConfigError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONFIG_ERROR", cause);
    this.name = "ConfigError";
  }
}

export class CalendarAuthError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super(message, "CALENDAR_AUTH_ERROR", cause);
    this.name = "CalendarAuthError";
  }
}

export class RateLimitError extends DomainError {
  public readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number, cause?: unknown) {
    super(message, "RATE_LIMIT", cause);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}
