import type { IntentHandler } from "../core/types.js";
import { createEventHandler } from "./create-event.handler.js";
import { deleteEventHandler } from "./delete-event.handler.js";
import { updateEventHandler } from "./update-event.handler.js";
import { listEventsHandler } from "./list-events.handler.js";
import { dailySummaryHandler } from "./daily-summary.handler.js";
import { unknownHandler } from "./unknown.handler.js";

export function buildHandlerRegistry(): Map<string, IntentHandler> {
  const handlers: IntentHandler[] = [
    createEventHandler,
    deleteEventHandler,
    updateEventHandler,
    listEventsHandler,
    dailySummaryHandler,
    unknownHandler,
  ];

  const registry = new Map<string, IntentHandler>();
  for (const handler of handlers) {
    registry.set(handler.intentType, handler);
  }
  return registry;
}
