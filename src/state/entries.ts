// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  iniFileLoader,
  type EntryStatus as SdkEntryStatus,
  type TranslationDocument,
  type TranslationEntry as SdkTranslationEntry,
} from "@mgt/sdk";
import {
  necesseEntryExt,
  necesseGameLoader,
  necesseStatusStrategy,
  type NecesseEntryExt,
} from "@mgt/mod-necesse";
import { checkPlaceholders } from "@/core/tokens/protected";
import { scanWhitespace } from "@/core/model/whitespace";
import type { EntryStatus as LegacyStatus } from "@/core/lang/markers";
import type { WorkspaceUiFlags } from "@/core/persistence/idb";
import {
  countFromIndex,
  glossaryFingerprint,
  sameRowIndex,
  type GlossaryLike,
  type RowIndex,
} from "@/core/persistence/row-index";
import { inspectTerminology } from "@/core/glossary/matcher";

export type { GlossaryLike, RowIndex };
export { countFromIndex, glossaryFingerprint, sameRowIndex };

export interface WorkspaceEntry {
  /** Native SDK entry id — stable across edits, unlike the old positional LangLine.id. */
  id: string;
  key: string;
  namespace: string;
  /** Matched reference, or the frozen original — always populated (== SDK entry.source). Feeds placeholder checks & MT. */
  source: string;
  target: string;
  /** RHS as originally parsed (frozen) — used to tell "still untouched" from "edited". */
  originalValue: string;
  /** Matched reference text, or null when no reference was matched for this entry. */
  referenceText: string | null;
  markedSame: boolean;
  wasMissing: boolean;
  touched: boolean;
  mtDraft: boolean;
  legacyStatus: LegacyStatus;
}

export type WorkspaceLine =
  { type: "section"; name: string } | { type: "entry"; entry: WorkspaceEntry };

/**
 * Collapses the SDK's 6-way EntryStatus to the app's 3-way vocabulary
 * (missing/done/same). Lossless for necesseStatusStrategy, which only ever
 * produces "missing"/"translated"/"same" today; the remaining SDK statuses
 * are mapped so this stays total once other game loaders reuse this layer.
 */
export function toLegacyStatus(status: SdkEntryStatus): LegacyStatus {
  switch (status) {
    case "same":
      return "same";
    case "missing":
    case "new":
      return "missing";
    case "translated":
    case "draft":
    case "reviewed":
      return "done";
  }
}

function toWorkspaceEntry(
  entry: SdkTranslationEntry,
  uiFlags: WorkspaceUiFlags | undefined,
): WorkspaceEntry {
  const ext = necesseEntryExt(entry);
  return {
    id: entry.id,
    key: entry.key,
    namespace: entry.namespace ?? "",
    source: entry.source,
    target: entry.target,
    originalValue: ext.originalValue,
    referenceText: ext.hasReference ? entry.source : null,
    markedSame: ext.markedSame,
    wasMissing: ext.wasMissing,
    touched: uiFlags?.touched ?? false,
    mtDraft: uiFlags?.mtDraft ?? false,
    legacyStatus: toLegacyStatus(entry.status),
  };
}

export function buildWorkspaceEntries(
  document: TranslationDocument,
  uiFlags: ReadonlyMap<string, WorkspaceUiFlags>,
): WorkspaceEntry[] {
  const entries: WorkspaceEntry[] = [];
  for (const node of document.nodes) {
    if (node.type !== "entry") continue;
    entries.push(toWorkspaceEntry(node.entry, uiFlags.get(node.entry.id)));
  }
  return entries;
}

/** Interleaved section/entry stream the editor groups its virtual list by (blank/comment/header nodes carry nothing the UI shows). */
export function buildWorkspaceLines(
  document: TranslationDocument,
  uiFlags: ReadonlyMap<string, WorkspaceUiFlags>,
): WorkspaceLine[] {
  const lines: WorkspaceLine[] = [];
  for (const node of document.nodes) {
    if (node.type === "section") lines.push({ type: "section", name: node.name });
    else if (node.type === "entry") {
      lines.push({
        type: "entry",
        entry: toWorkspaceEntry(node.entry, uiFlags.get(node.entry.id)),
      });
    }
  }
  return lines;
}

export function buildEntryIndex(
  entries: readonly WorkspaceEntry[],
): ReadonlyMap<string, WorkspaceEntry> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/** Finds one entry by id straight from the document — handy right after a mutation, without rebuilding the full list. */
export function findWorkspaceEntry(
  document: TranslationDocument,
  entryId: string,
  uiFlags: ReadonlyMap<string, WorkspaceUiFlags>,
): WorkspaceEntry | undefined {
  const node = document.nodes.find((n) => n.type === "entry" && n.entry.id === entryId);
  return node?.type === "entry" ? toWorkspaceEntry(node.entry, uiFlags.get(entryId)) : undefined;
}

/**
 * The reference block shown above the textarea, and the baseline whitespace
 * checks compare against — non-null only when a reference was actually
 * matched, or the entry was flagged missing (its frozen original then stands
 * in). An already-translated entry with neither gets no reference at all.
 */
export function referenceDisplayText(entry: WorkspaceEntry): string | null {
  return entry.referenceText ?? (entry.wasMissing ? entry.originalValue : null);
}

export function hasUsableReference(
  entries: readonly WorkspaceEntry[],
  referenceFilename: string,
): boolean {
  return Boolean(referenceFilename) && entries.some((entry) => entry.referenceText != null);
}

/** Recomputes entry.status the same way toDocument does, keeping fromDocument's export correct after an edit. */
function withUpdatedNecesseEntry(
  entry: SdkTranslationEntry,
  patch: { target?: string; markedSame?: boolean },
): SdkTranslationEntry {
  const ext = necesseEntryExt(entry);
  const nextExt: NecesseEntryExt = {
    ...ext,
    ...(patch.markedSame !== undefined ? { markedSame: patch.markedSame } : {}),
  };
  const draft = { ...entry, target: patch.target ?? entry.target, ext: nextExt };
  const status = necesseStatusStrategy.fromNative(draft, {
    markedSame: nextExt.markedSame,
    wasMissing: nextExt.wasMissing,
    hasReference: nextExt.hasReference,
  });
  return { ...draft, status };
}

/** Immutable — no-op (returns the same document reference) if entryId doesn't match any node. */
export function updateEntryTarget(
  document: TranslationDocument,
  entryId: string,
  target: string,
): TranslationDocument {
  let changed = false;
  const nodes = document.nodes.map((node) => {
    if (node.type !== "entry" || node.entry.id !== entryId) return node;
    changed = true;
    return { ...node, entry: withUpdatedNecesseEntry(node.entry, { target }) };
  });
  return changed ? { ...document, nodes } : document;
}

/** No-op (returns the same document reference) if the entry has no matched reference to mark same against. */
export function toggleEntryMarkedSame(
  document: TranslationDocument,
  entryId: string,
): TranslationDocument {
  let changed = false;
  const nodes = document.nodes.map((node) => {
    if (node.type !== "entry" || node.entry.id !== entryId) return node;
    const ext = necesseEntryExt(node.entry);
    if (!ext.hasReference) return node;
    changed = true;
    return { ...node, entry: withUpdatedNecesseEntry(node.entry, { markedSame: !ext.markedSame }) };
  });
  return changed ? { ...document, nodes } : document;
}

/** Serializes a document back to its native .lang text, mirroring exportLang's pipeline. */
export function exportedText(document: TranslationDocument): string {
  const raw = necesseGameLoader.fromDocument(document);
  return iniFileLoader.serialize(raw).files[0]?.text ?? "";
}

function enabledOnly(glossaries: readonly GlossaryLike[]): GlossaryLike[] {
  return glossaries.filter((glossary) => glossary.enabled !== false);
}

function indexWorkspaceEntry(entry: WorkspaceEntry, enabled: GlossaryLike[]): RowIndex {
  return {
    status: entry.legacyStatus,
    tokenIssue: checkPlaceholders(entry.source, entry.target).length > 0,
    wsIssue: scanWhitespace(entry.target, referenceDisplayText(entry)).any,
    glossaryIssue: inspectTerminology(entry.source, entry.target, enabled, entry.key).length > 0,
    hasRef: entry.referenceText != null,
  };
}

export function buildWorkspaceRowIndex(
  entries: readonly WorkspaceEntry[],
  glossaries: readonly GlossaryLike[],
): Map<string, RowIndex> {
  const enabled = enabledOnly(glossaries);
  const map = new Map<string, RowIndex>();
  for (const entry of entries) map.set(entry.id, indexWorkspaceEntry(entry, enabled));
  return map;
}

export function reindexWorkspaceEntry(
  map: Map<string, RowIndex>,
  entry: WorkspaceEntry,
  glossaries: readonly GlossaryLike[],
): RowIndex {
  const next = indexWorkspaceEntry(entry, enabledOnly(glossaries));
  map.set(entry.id, next);
  return next;
}
