const ROOM_CREATE_LIMIT = 10;
const ROOM_CREATE_WINDOW_MS = 60_000;

// A loopback peer is the on-host proxy (production binds Node to 127.0.0.1).
// The address that proxy added is the last X-Forwarded-For entry. Anything
// earlier was supplied by the client and is not the caller. Any other socket
// peer is the caller itself.
const TRUSTED_PROXY_PEERS = new Set(["127.0.0.1", "::1"]);

function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  const mapped = /^::ffff:(.+)$/i.exec(trimmed);
  return mapped?.[1] ?? trimmed;
}

function appendedAddress(forwardedFor: string | undefined): string | undefined {
  const parts = forwardedFor
    ?.split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts?.at(-1);
}

export function roomCreateCaller(
  peerAddress: string | undefined,
  forwardedFor: string | undefined,
): string {
  const peer = normalizeAddress(peerAddress ?? "");
  if (peer.length === 0) return "unknown";
  if (!TRUSTED_PROXY_PEERS.has(peer)) return peer;
  const appended = appendedAddress(forwardedFor);
  return appended === undefined ? peer : normalizeAddress(appended);
}

export class RoomCreateLimiter {
  private readonly hits = new Map<string, number[]>();

  allow(caller: string, now: number): boolean {
    this.dropAged(now);
    const recent = this.hits.get(caller) ?? [];
    if (recent.length >= ROOM_CREATE_LIMIT) return false;
    recent.push(now);
    this.hits.set(caller, recent);
    return true;
  }

  callers(): readonly string[] {
    return [...this.hits.keys()];
  }

  private dropAged(now: number): void {
    for (const [caller, timestamps] of this.hits) {
      const fresh = timestamps.filter((timestamp) => now - timestamp < ROOM_CREATE_WINDOW_MS);
      if (fresh.length === 0) this.hits.delete(caller);
      else if (fresh.length !== timestamps.length) this.hits.set(caller, fresh);
    }
  }
}
