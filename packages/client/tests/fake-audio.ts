/**
 * A Web Audio graph that records what was asked of it, and the device storage the
 * preferences live in. The test environment provides neither, and the band is the one part
 * of the client that cannot be read off the screen: these let a test read it off the graph.
 */

/** A curve as the fake param recorded it: what it ramped to, from when, over how long. */
export interface Ramp {
  readonly curve: readonly number[];
  readonly start: number;
  readonly seconds: number;
}

/**
 * A param that keeps the browser's rule about curves: nothing may be scheduled inside one,
 * and a plain write to `value` is a change scheduled now. Cancelling at a time also ends a
 * curve still running then, as the Web Audio spec has it.
 */
export class FakeParam {
  readonly ramps: Ramp[] = [];
  readonly cancellations: number[] = [];
  private current = 0;
  private scheduled: Ramp[] = [];

  constructor(private readonly clock: { readonly currentTime: number }) {}

  get value(): number {
    return this.current;
  }

  set value(next: number) {
    this.refuseOverlap(this.clock.currentTime, 0);
    this.current = next;
  }

  cancelScheduledValues(when: number): void {
    this.cancellations.push(when);
    this.scheduled = this.scheduled.filter((ramp) => ramp.start + ramp.seconds <= when);
  }

  setValueCurveAtTime(curve: Float32Array, start: number, seconds: number): void {
    this.refuseOverlap(start, seconds);
    const ramp = { curve: [...curve], start, seconds };
    this.ramps.push(ramp);
    this.scheduled.push(ramp);
    this.current = curve.at(-1) ?? this.current;
  }

  private refuseOverlap(start: number, seconds: number): void {
    const clash = this.scheduled.find(
      (ramp) =>
        (ramp.start <= start && start < ramp.start + ramp.seconds) ||
        (start < ramp.start && ramp.start < start + seconds),
    );
    if (clash) {
      throw new DOMException(
        `A change at ${start} overlaps the curve from ${clash.start} to ${clash.start + clash.seconds}.`,
        "NotSupportedError",
      );
    }
  }
}

export class FakeNode {
  connectedTo: unknown = null;
  disconnected = false;

  connect<T>(destination: T): T {
    this.connectedTo = destination;
    return destination;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

export class FakeGain extends FakeNode {
  readonly gain: FakeParam;

  constructor(clock: { readonly currentTime: number }) {
    super();
    this.gain = new FakeParam(clock);
  }
}

export class FakeSource extends FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  startedAt: number | null = null;
  startedFrom: number | null = null;
  stoppedAt: number | null = null;

  start(when: number, offset?: number): void {
    this.startedAt = when;
    this.startedFrom = offset ?? 0;
  }

  stop(when?: number): void {
    this.stoppedAt = when ?? 0;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = "suspended";
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  readonly decoded: ArrayBuffer[] = [];

  createGain(): FakeGain {
    const gain = new FakeGain(this);
    this.gains.push(gain);
    return gain;
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  async decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
    this.decoded.push(bytes);
    return { duration: 60, sampleRate: 44_100 } as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.state = "running";
  }

  async suspend(): Promise<void> {
    this.state = "suspended";
  }

  async close(): Promise<void> {
    this.state = "closed";
  }
}

/** The graph, as the band's own code sees it. */
export const asAudioContext = (context: FakeAudioContext) => context as unknown as AudioContext;

/** Device storage for a test run, since neither happy-dom nor Node provides one here. */
export function installLocalStorage(): Storage {
  const held = new Map<string, string>();
  const storage = {
    get length() {
      return held.size;
    },
    key: (index: number) => [...held.keys()][index] ?? null,
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => void held.set(key, value),
    removeItem: (key: string) => void held.delete(key),
    clear: () => held.clear(),
  } satisfies Storage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return storage;
}
