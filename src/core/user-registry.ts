import type { CalendarProviderPort } from "../ports/calendar-provider.port.js";

export interface UserConfig {
  phoneNumber: string;
  name: string;
  googleRefreshToken: string;
  timezone?: string;
}

export interface RegisteredUser {
  phoneNumber: string;
  name: string;
  timezone: string;
  calendar: CalendarProviderPort;
}

export class UserRegistry {
  private readonly users = new Map<string, RegisteredUser>();

  register(user: RegisteredUser): void {
    this.users.set(user.phoneNumber, user);
  }

  get(phoneNumber: string): RegisteredUser | undefined {
    return this.users.get(phoneNumber);
  }

  has(phoneNumber: string): boolean {
    return this.users.has(phoneNumber);
  }

  update(phoneNumber: string, fields: Partial<Omit<RegisteredUser, "phoneNumber">>): void {
    const existing = this.users.get(phoneNumber);
    if (!existing) return;
    this.users.set(phoneNumber, { ...existing, ...fields });
  }

  getAll(): RegisteredUser[] {
    return Array.from(this.users.values());
  }
}
