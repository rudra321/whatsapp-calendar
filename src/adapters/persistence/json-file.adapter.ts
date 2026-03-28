import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

export interface PersistedUser {
  phoneNumber: string;
  name: string;
  googleRefreshToken: string;
  timezone?: string;
}

export class JsonFileUserStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = join(dataDir, "users.json");
  }

  load(): PersistedUser[] {
    if (!existsSync(this.filePath)) return [];
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as PersistedUser[];
    } catch {
      return [];
    }
  }

  save(user: PersistedUser): void {
    const users = this.load();
    const index = users.findIndex((u) => u.phoneNumber === user.phoneNumber);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(users, null, 2), "utf-8");
  }
}
