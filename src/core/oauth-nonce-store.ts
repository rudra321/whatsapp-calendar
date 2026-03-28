const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface NonceEntry {
  phoneNumber: string;
  expiresAt: number;
}

export class OAuthNonceStore {
  private readonly entries = new Map<string, NonceEntry>();

  create(phoneNumber: string): string {
    this.cleanup();
    const nonce = crypto.randomUUID();
    this.entries.set(nonce, {
      phoneNumber,
      expiresAt: Date.now() + TTL_MS,
    });
    return nonce;
  }

  consume(nonce: string): string | null {
    this.cleanup();
    const entry = this.entries.get(nonce);
    if (!entry) return null;
    this.entries.delete(nonce);
    return entry.phoneNumber;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [nonce, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(nonce);
      }
    }
  }
}
