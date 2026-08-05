// SPDX-License-Identifier: AGPL-3.0-or-later
import { inspectTerminology } from "@/core/glossary/matcher";
import type { NormalizedGlossary } from "@/core/glossary/loader";
import type { EntryStatus, LangLine } from "@/core/lang/markers";
import { statusOf, sourceText, type TranslationEntry } from "@/core/lang/status";
import { missingTokens } from "@/core/tokens/protected";
import { scanWhitespace } from "@/core/tokens/whitespace";

/** Bump when IndexedDB object-store shape changes. */
export const SCHEMA_VERSION = 1;

/** Bump when status / token / whitespace / glossary indexing logic changes. */
export const INDEXER_VERSION = 1;

export interface RowIndex {
  status: EntryStatus;
  tokenIssue: boolean;
  wsIssue: boolean;
  glossaryIssue: boolean;
  hasRef: boolean;
}

export type GlossaryLike = NormalizedGlossary & { enabled?: boolean };

function enabledOnly(glossaries: readonly GlossaryLike[]): GlossaryLike[] {
  return glossaries.filter((glossary) => glossary.enabled !== false);
}

/** FNV-1a — not a digest, just a cheap change detector for the stored index. */
function hashChunk(hash: number, text: string): number {
  let next = hash;
  for (let i = 0; i < text.length; i += 1) {
    next ^= text.charCodeAt(i);
    next = Math.imul(next, 0x01000193);
  }
  // Separator, so ["ab","c"] and ["a","bc"] cannot collide.
  return Math.imul(next ^ 0x1f, 0x01000193);
}

/**
 * Hashing a library is linear in its text and the fingerprint is taken on every
 * save — but a glossary object is replaced wholesale when it changes, so the
 * hash can be cached against that identity. Large libraries pay for it once.
 */
const ruleHashCache = new WeakMap<object, string>();

function glossaryRuleHash(glossary: GlossaryLike): string {
  const cached = ruleHashCache.get(glossary);
  if (cached !== undefined) return cached;
  let hash = 0x811c9dc5;
  for (const entry of glossary.entries) {
    hash = hashChunk(hash, entry.source);
    hash = hashChunk(hash, entry.target);
    hash = hashChunk(hash, entry.forms.join(","));
    hash = hashChunk(hash, entry.alternatives.join(","));
    hash = hashChunk(hash, entry.forbidden.join(","));
    hash = hashChunk(hash, entry.caseSensitive ? "1" : "0");
    hash = hashChunk(hash, entry.wholeWord ? "1" : "0");
    hash = hashChunk(hash, entry.status);
  }
  const digest = (hash >>> 0).toString(36);
  ruleHashCache.set(glossary, digest);
  return digest;
}

/**
 * Identifies the terminology rules the stored `glossaryIssue` flags were built
 * from. It hashes the matched fields rather than trusting `updatedAt`, which is
 * day-granular — two edits on the same day would otherwise look unchanged and
 * leave a stale index behind.
 */
export function glossaryFingerprint(glossaries: readonly GlossaryLike[]): string {
  const enabled = enabledOnly(glossaries);
  if (!enabled.length) return "empty";
  return [...enabled]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((glossary) => `${glossary.id}:${glossary.entries.length}:${glossaryRuleHash(glossary)}`)
    .join("|");
}

export function indexEntry(entry: TranslationEntry, glossaries: readonly GlossaryLike[]): RowIndex {
  return indexEntryWith(entry, enabledOnly(glossaries));
}

/** Same as `indexEntry`, for callers that already filtered the enabled set. */
function indexEntryWith(entry: TranslationEntry, enabled: GlossaryLike[]): RowIndex {
  return {
    status: statusOf(entry),
    tokenIssue: missingTokens(entry).length > 0,
    wsIssue: scanWhitespace(entry).any,
    glossaryIssue: inspectTerminology(sourceText(entry), entry.value, enabled).length > 0,
    hasRef: entry.ref != null,
  };
}

/** True when both rows carry the same filter-relevant flags. */
export function sameRowIndex(a: RowIndex | undefined, b: RowIndex | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.status === b.status &&
    a.tokenIssue === b.tokenIssue &&
    a.wsIssue === b.wsIssue &&
    a.glossaryIssue === b.glossaryIssue &&
    a.hasRef === b.hasRef
  );
}

export function buildRowIndexMap(
  items: readonly LangLine[],
  glossaries: readonly GlossaryLike[],
): Map<number, RowIndex> {
  const map = new Map<number, RowIndex>();
  // Filtered once — this runs over every line of the file.
  const enabled = enabledOnly(glossaries);
  for (const item of items) {
    if (item.type !== "entry") continue;
    map.set(item.id, indexEntryWith(item, enabled));
  }
  return map;
}

export function reindexOne(
  map: Map<number, RowIndex>,
  entry: TranslationEntry,
  glossaries: readonly GlossaryLike[],
): RowIndex {
  const next = indexEntry(entry, glossaries);
  map.set(entry.id, next);
  return next;
}

export function countFromIndex(map: ReadonlyMap<number, RowIndex>): {
  done: number;
  total: number;
  wsIssues: number;
  glossaryIssues: number;
} {
  let done = 0;
  let total = 0;
  let wsIssues = 0;
  let glossaryIssues = 0;
  for (const row of map.values()) {
    total += 1;
    if (row.status !== "missing") done += 1;
    if (row.wsIssue) wsIssues += 1;
    if (row.glossaryIssue) glossaryIssues += 1;
  }
  return { done, total, wsIssues, glossaryIssues };
}
