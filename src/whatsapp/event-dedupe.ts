import type { NormalizedWahaMessage, NormalizedWahaReaction } from "./events";

type NormalizedWahaEvent = NormalizedWahaMessage | NormalizedWahaReaction;

interface RecentWahaEventDedupeOptions {
  ttlMs: number;
  now?: () => number;
  maxEntries?: number;
}

export class RecentWahaEventDedupe {
  private readonly seen = new Map<string, number>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: RecentWahaEventDedupeOptions) {
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? 2_000;
  }

  accept(event: NormalizedWahaEvent): boolean {
    const key = this.key(event);
    const currentTime = this.now();
    this.prune(currentTime);

    if (this.seen.has(key)) {
      return false;
    }

    this.seen.set(key, currentTime + this.ttlMs);
    return true;
  }

  private key(event: NormalizedWahaEvent): string {
    return [event.type, event.session, event.chatId, event.messageId].join(":");
  }

  private prune(currentTime: number): void {
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= currentTime || this.seen.size >= this.maxEntries) {
        this.seen.delete(key);
      }
    }
  }
}
