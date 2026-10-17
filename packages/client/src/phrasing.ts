/** Joins choices as prose: "Open", "Open or Closed", "Open, Closed, or Half-Open". */
export function alternatives(values: readonly string[]): string {
  if (values.length < 2) return values[0] ?? "the required Position";
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}
