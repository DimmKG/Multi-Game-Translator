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
import type { EntryStatus as LegacyStatus } from "@/core/lang/markers";
import type { WorkspaceUiFlags } from "@/core/persistence/idb";

export interface WorkspaceEntry {
  /** Native SDK entry id — stable across edits, unlike the old positional LangLine.id. */
  id: string;
  key: string;
  namespace: string;
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

export function buildEntryIndex(
  entries: readonly WorkspaceEntry[],
): ReadonlyMap<string, WorkspaceEntry> {
  return new Map(entries.map((entry) => [entry.id, entry]));
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

/** Immutable — returns a new document with just the targeted node's entry replaced. */
export function updateEntryTarget(
  document: TranslationDocument,
  entryId: string,
  target: string,
): TranslationDocument {
  const nodes = document.nodes.map((node) => {
    if (node.type !== "entry" || node.entry.id !== entryId) return node;
    return { ...node, entry: withUpdatedNecesseEntry(node.entry, { target }) };
  });
  return { ...document, nodes };
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
