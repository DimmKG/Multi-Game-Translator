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

export function glossaryFingerprint(glossaries: readonly GlossaryLike[]): string {
  const enabled = glossaries.filter((glossary) => glossary.enabled !== false);
  if (!enabled.length) return "empty";
  return [...enabled]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((glossary) => `${glossary.id}:${glossary.updatedAt}:${glossary.entries.length}`)
    .join("|");
}

export function indexEntry(entry: TranslationEntry, glossaries: readonly GlossaryLike[]): RowIndex {
  const enabled = glossaries.filter((glossary) => glossary.enabled !== false);
  return {
    status: statusOf(entry),
    tokenIssue: missingTokens(entry).length > 0,
    wsIssue: scanWhitespace(entry).any,
    glossaryIssue: inspectTerminology(sourceText(entry), entry.value, enabled).length > 0,
    hasRef: entry.ref != null,
  };
}

export function buildRowIndexMap(
  items: readonly LangLine[],
  glossaries: readonly GlossaryLike[],
): Map<number, RowIndex> {
  const map = new Map<number, RowIndex>();
  for (const item of items) {
    if (item.type !== "entry") continue;
    map.set(item.id, indexEntry(item, glossaries));
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
