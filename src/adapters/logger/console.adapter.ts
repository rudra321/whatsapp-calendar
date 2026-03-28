import type { LoggerPort } from "../../ports/logger.port.js";

export class ConsoleLogger implements LoggerPort {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.format("INFO", message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.format("WARN", message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.format("ERROR", message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(this.format("DEBUG", message, meta));
  }

  private format(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }
}
