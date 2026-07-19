import cardsJson from "./data/cards.json" with { type: "json" };
import songJson from "./data/song-lloraras.json" with { type: "json" };
import { canonicalStringify, hashCanonical, sha256Hex } from "./canonical.js";
import { ContentSetSchema, type ContentSet, type DanceCard } from "./schema.js";

export * from "./canonical.js";
export * from "./schema.js";

export const content = ContentSetSchema.parse({ ...cardsJson, song: songJson });
export const contentBytes = canonicalStringify(content);
export const contentHash = sha256Hex(contentBytes);

export const cardsById = Object.fromEntries(content.cards.map((card) => [card.id, card])) as Record<
  string,
  DanceCard
>;

export function parseContentBytes(bytes: string): ContentSet {
  return ContentSetSchema.parse(JSON.parse(bytes));
}

export function verifyContentHash(bytes: string, expectedHash: string): ContentSet {
  const parsed = parseContentBytes(bytes);
  if (hashCanonical(parsed) !== expectedHash)
    throw new Error("Content hash does not match content bytes.");
  return parsed;
}
