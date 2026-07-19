export function nextRandom(state: number): { value: number; state: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296, state: nextState };
}

export function shuffle<T>(
  items: readonly T[],
  initialState: number,
): { items: T[]; state: number } {
  const shuffled = [...items];
  let state = initialState >>> 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = nextRandom(state);
    state = random.state;
    const target = Math.floor(random.value * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return { items: shuffled, state };
}
