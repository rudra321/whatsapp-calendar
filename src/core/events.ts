import type { DomainEventPayloads, DomainEventType } from "./types.js";

type EventHandler<T extends DomainEventType> = (payload: DomainEventPayloads[T]) => void;

export class EventBus {
  private listeners = new Map<DomainEventType, Set<EventHandler<any>>>();

  on<T extends DomainEventType>(event: T, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  emit<T extends DomainEventType>(event: T, payload: DomainEventPayloads[T]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch {
        // Swallow listener errors to prevent cascading failures
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
