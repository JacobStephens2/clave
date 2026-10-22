import {
  ENGINE_VERSION,
  applyEnvelopeAction,
  createEnvelope,
  envelopeSnapshot,
  rehydrateEnvelope,
  type GameAction,
  type PlayerSnapshot,
  type ResumeEnvelope,
  type Role,
} from "@clave/engine";
import { create } from "zustand";

const HOTSEAT_KEY = "clave.hotseat.v1";
const ONLINE_KEY = "clave.onlineSeat.v1";

interface OnlineSeat {
  code: string;
  role: Role;
  seatToken: string;
}

/** The online partner: seat still unclaimed, connected now, or dropped away. */
export type PartnerPresence = "absent" | "connected" | "away";

interface AppStore {
  screen: "home" | "game";
  mode: "hotseat" | "online" | null;
  envelope: ResumeEnvelope | null;
  snapshot: PlayerSnapshot | null;
  viewerRole: Role;
  passTo: Role | null;
  onlineSeat: OnlineSeat | null;
  connection: "offline" | "connecting" | "connected" | "reconnecting";
  partnerPresence: PartnerPresence | null;
  error: string | null;
  hasHotseatResume: boolean;
  hasOnlineResume: boolean;
  hydrate: () => void;
  newHotseat: () => void;
  resumeHotseat: () => void;
  discardHotseat: () => void;
  acceptPass: () => void;
  dispatch: (action: GameAction) => void;
  createOnline: (role: Role) => Promise<void>;
  joinOnline: (code: string, role: Role) => Promise<void>;
  resumeOnline: () => void;
  forgetOnline: () => void;
  leaveGame: () => void;
  clearError: () => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

function desiredRole(envelope: ResumeEnvelope): Role {
  return envelope.state.status === "setup" ? envelope.state.setupRole : envelope.state.activeRole;
}

function readOnlineSeat(): OnlineSeat | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(ONLINE_KEY) ?? "null",
    ) as Partial<OnlineSeat> | null;
    if (
      value &&
      typeof value.code === "string" &&
      (value.role === "lead" || value.role === "follow") &&
      typeof value.seatToken === "string"
    ) {
      return value as OnlineSeat;
    }
  } catch {
    // A damaged local hint is simply ignored; the server remains authoritative.
  }
  return null;
}

// The saved game, rehydrated. A save that rehydration changed is written back; an unresumable
// one counts as no save.
function readHotseat(): ResumeEnvelope | null {
  try {
    const raw = localStorage.getItem(HOTSEAT_KEY);
    if (!raw) return null;
    const { kind, envelope, detail } = rehydrateEnvelope(JSON.parse(raw));
    if (kind !== "resumed") {
      localStorage.setItem(HOTSEAT_KEY, JSON.stringify(envelope));
      console.warn(`[clave] hot-seat save ${kind}: ${detail}`);
    }
    return envelope.state.status === "unresumable" ? null : envelope;
  } catch {
    return null;
  }
}

function completionBeacon(envelope: ResumeEnvelope): void {
  if (envelope.state.status !== "completed" && envelope.state.status !== "lost") return;
  const payload = JSON.stringify({ gameId: envelope.state.gameId, type: envelope.state.status });
  navigator.sendBeacon?.("/api/events/hotseat", new Blob([payload], { type: "application/json" }));
}

function closeSocket(): void {
  if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const previous = socket;
  socket = null;
  previous?.close();
  reconnectAttempt = 0;
}

export const useAppStore = create<AppStore>((set, get) => {
  const connectOnline = (seat: OnlineSeat, reconnecting = false): void => {
    closeSocket();
    set({
      connection: reconnecting ? "reconnecting" : "connecting",
      partnerPresence: null,
      error: null,
    });
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const query = new URLSearchParams({
      code: seat.code,
      role: seat.role,
      token: seat.seatToken,
      engineVersion: String(ENGINE_VERSION),
    });
    const connectingSocket = new WebSocket(`${protocol}//${location.host}/ws?${query}`);
    socket = connectingSocket;
    connectingSocket.addEventListener("open", () => {
      reconnectAttempt = 0;
      set({ connection: "connected", error: null });
    });
    connectingSocket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as
          | { type: "snapshot"; snapshot: PlayerSnapshot }
          | { type: "presence"; partner: PartnerPresence }
          | { type: "error"; message: string };
        if (message.type === "snapshot") {
          set({
            snapshot: message.snapshot,
            screen: "game",
            mode: "online",
            viewerRole: seat.role,
          });
        } else if (message.type === "presence") {
          set({ partnerPresence: message.partner });
        } else {
          set({ error: message.message });
        }
      } catch {
        set({ error: "The room sent an unreadable update." });
      }
    });
    connectingSocket.addEventListener("close", (event) => {
      if (socket !== connectingSocket) return;
      socket = null;
      set({ partnerPresence: null });
      if (get().mode !== "online" || !get().onlineSeat) return;
      if (event.code === 4401 || event.code === 4409) {
        set({ connection: "offline", error: event.reason || "This seat can no longer reconnect." });
        return;
      }
      reconnectAttempt += 1;
      set({ connection: "reconnecting" });
      reconnectTimer = window.setTimeout(
        () => {
          const current = get().onlineSeat;
          if (current) connectOnline(current, true);
        },
        Math.min(10_000, 500 * 2 ** reconnectAttempt),
      );
    });
  };

  const saveSeat = (seat: OnlineSeat): void => {
    localStorage.setItem(ONLINE_KEY, JSON.stringify(seat));
    set({
      onlineSeat: seat,
      hasOnlineResume: true,
      mode: "online",
      screen: "game",
      viewerRole: seat.role,
    });
    connectOnline(seat);
  };

  return {
    screen: "home",
    mode: null,
    envelope: null,
    snapshot: null,
    viewerRole: "lead",
    passTo: null,
    onlineSeat: null,
    connection: "offline",
    partnerPresence: null,
    error: null,
    hasHotseatResume: false,
    hasOnlineResume: false,

    hydrate: () => {
      set({ hasHotseatResume: Boolean(readHotseat()), hasOnlineResume: Boolean(readOnlineSeat()) });
    },

    newHotseat: () => {
      closeSocket();
      const seed = randomSeed();
      const envelope = createEnvelope({ seed, gameId: `hot-${seed}` });
      localStorage.setItem(HOTSEAT_KEY, JSON.stringify(envelope));
      set({
        screen: "game",
        mode: "hotseat",
        envelope,
        viewerRole: "lead",
        snapshot: envelopeSnapshot(envelope, "lead"),
        passTo: "lead",
        error: null,
        hasHotseatResume: true,
        connection: "offline",
      });
    },

    resumeHotseat: () => {
      const envelope = readHotseat();
      if (!envelope) {
        set({ error: "That saved dance can no longer be resumed.", hasHotseatResume: false });
        return;
      }
      const role = desiredRole(envelope);
      set({
        screen: "game",
        mode: "hotseat",
        envelope,
        viewerRole: role,
        snapshot: envelopeSnapshot(envelope, role),
        passTo: role,
        error: null,
        connection: "offline",
      });
    },

    discardHotseat: () => {
      localStorage.removeItem(HOTSEAT_KEY);
      set({ hasHotseatResume: false, envelope: null });
    },

    acceptPass: () => {
      const envelope = get().envelope;
      const role = get().passTo;
      if (!envelope || !role) return;
      set({ viewerRole: role, snapshot: envelopeSnapshot(envelope, role), passTo: null });
    },

    dispatch: (action) => {
      if (get().mode === "online") {
        const view = get().snapshot;
        if (!view || !socket || socket.readyState !== WebSocket.OPEN) {
          set({ error: "Reconnect before taking an action." });
          return;
        }
        socket.send(JSON.stringify({ type: "action", sequence: view.sequence, action }));
        return;
      }
      const envelope = get().envelope;
      if (!envelope) return;
      const beforeRole = desiredRole(envelope);
      const result = applyEnvelopeAction(envelope, action);
      if (!result.ok) {
        set({ error: result.error.message });
        return;
      }
      localStorage.setItem(HOTSEAT_KEY, JSON.stringify(result.envelope));
      const afterRole = desiredRole(result.envelope);
      const passTo =
        afterRole !== beforeRole &&
        result.envelope.state.status !== "completed" &&
        result.envelope.state.status !== "lost"
          ? afterRole
          : null;
      const viewer = passTo ? get().viewerRole : afterRole;
      const snapshot = envelopeSnapshot(result.envelope, viewer);
      set({ envelope: result.envelope, snapshot, passTo, error: null });
      completionBeacon(result.envelope);
    },

    createOnline: async (role) => {
      set({ error: null });
      try {
        const response = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        const body = (await response.json()) as OnlineSeat & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not create a room.");
        saveSeat({ code: body.code, role: body.role, seatToken: body.seatToken });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : "Could not create a room." });
      }
    },

    joinOnline: async (code, role) => {
      set({ error: null });
      try {
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(code.replace(/\s+/g, ""))}/join`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
          },
        );
        const body = (await response.json()) as OnlineSeat & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not join that room.");
        saveSeat({ code: body.code, role: body.role, seatToken: body.seatToken });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : "Could not join that room." });
      }
    },

    resumeOnline: () => {
      const seat = readOnlineSeat();
      if (!seat) {
        set({ error: "No saved room seat was found.", hasOnlineResume: false });
        return;
      }
      set({ onlineSeat: seat, screen: "game", mode: "online", viewerRole: seat.role });
      connectOnline(seat);
    },

    forgetOnline: () => {
      localStorage.removeItem(ONLINE_KEY);
      set({ hasOnlineResume: false, onlineSeat: null });
    },

    leaveGame: () => {
      // A finished room has nothing to return to, so its seat is not offered again.
      const status = get().snapshot?.status;
      const finished =
        get().mode === "online" &&
        (status === "completed" || status === "lost" || status === "unresumable");
      closeSocket();
      if (finished) localStorage.removeItem(ONLINE_KEY);
      set({
        screen: "home",
        mode: null,
        snapshot: null,
        envelope: null,
        passTo: null,
        connection: "offline",
        partnerPresence: null,
        error: null,
        ...(finished ? { hasOnlineResume: false, onlineSeat: null } : {}),
      });
    },

    clearError: () => set({ error: null }),
  };
});
