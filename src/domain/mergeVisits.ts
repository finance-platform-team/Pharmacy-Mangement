import type { Visit } from "./types";

/**
 * Merges a delta batch of changed/new visits into the existing list without
 * discarding untouched rows — mirrors PHWEBRESCOURCE.HTML's silent-refresh
 * merge (existing records updated in place by id, new ones added). Exact
 * position of new rows doesn't matter: the UI always re-sorts by
 * modifiedOn/queue/etc. downstream (see domain/filters.ts).
 */
export function mergeVisits(prev: Visit[], delta: Visit[]): Visit[] {
  if (delta.length === 0) return prev;

  const prevIds = new Set(prev.map((v) => v.id));
  const updatesById = new Map(delta.map((v) => [v.id, v]));
  const merged = prev.map((v) => updatesById.get(v.id) ?? v);
  const newOnes = delta.filter((v) => !prevIds.has(v.id));

  return newOnes.length > 0 ? [...newOnes, ...merged] : merged;
}
