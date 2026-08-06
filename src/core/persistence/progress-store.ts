// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LangLine } from "@/core/lang/markers";
import type { WorkspaceSnapshot } from "./serialize";
import { clearProgressFromLocalStorage, loadProgressFromLocalStorage } from "./serialize";
import { openNecesseDb, type WorkspaceMetaRecord } from "./idb";
import { assignEntrySections } from "@/core/lang/parse";
import { decodeLine, encodeLine, type StoredLine } from "./line-codec";
import {
  buildRowIndexMap,
  glossaryFingerprint,
  INDEXER_VERSION,
  SCHEMA_VERSION,
  type RowIndex,
  type GlossaryLike,
} from "./row-index";

const META_SCHEMA = "schemaVersion";
const META_INDEXER = "indexerVersion";
const META_GLOSSARY_FP = "glossaryFingerprint";
const META_WORKSPACE = "workspace";

export interface LoadedWorkspace {
  snapshot: WorkspaceSnapshot | null;
  rowIndexes: Map<number, RowIndex>;
  needsReindexWrite: boolean;
}

function toWorkspaceMeta(snapshot: WorkspaceSnapshot): WorkspaceMetaRecord {
  return {
    filename: snapshot.filename,
    referenceFilename: snapshot.referenceFilename,
    eol: snapshot.eol,
    savedAt: snapshot.savedAt,
    provider: snapshot.meta.provider,
    targetLanguage: snapshot.meta.targetLanguage,
    spellcheck: snapshot.meta.spellcheck,
    autocompleteEnabled: snapshot.meta.autocompleteEnabled,
  };
}

function fromWorkspaceMeta(meta: WorkspaceMetaRecord, items: LangLine[]): WorkspaceSnapshot {
  return {
    filename: meta.filename,
    referenceFilename: meta.referenceFilename,
    eol: meta.eol,
    savedAt: meta.savedAt,
    items,
    meta: {
      provider: meta.provider,
      targetLanguage: meta.targetLanguage,
      spellcheck: meta.spellcheck,
      autocompleteEnabled: meta.autocompleteEnabled,
    },
  };
}

export async function clearWorkspaceFromIdb() {
  const db = await openNecesseDb();
  const tx = db.transaction(["meta", "lines"], "readwrite");
  await tx.objectStore("lines").clear();
  await tx.objectStore("meta").delete(META_WORKSPACE);
  await tx.done;
}

export async function replaceWorkspaceInIdb(
  snapshot: WorkspaceSnapshot,
  rowIndexes: ReadonlyMap<number, RowIndex>,
  glossaries: readonly GlossaryLike[],
) {
  const db = await openNecesseDb();
  const tx = db.transaction(["meta", "lines"], "readwrite");
  const lines = tx.objectStore("lines");
  const pending: Promise<unknown>[] = [lines.clear()];
  // Queued without awaiting each one — a full file is tens of thousands of
  // rows, and one round trip per row is the difference between a blip and a
  // visible stall. `tx.done` is what actually reports failure.
  for (let i = 0; i < snapshot.items.length; i += 1) {
    const item = snapshot.items[i];
    const idx = item.type === "entry" ? rowIndexes.get(item.id) : undefined;
    pending.push(lines.put(encodeLine(item, i, idx)));
  }
  const meta = tx.objectStore("meta");
  pending.push(
    meta.put(SCHEMA_VERSION, META_SCHEMA),
    meta.put(INDEXER_VERSION, META_INDEXER),
    meta.put(glossaryFingerprint(glossaries), META_GLOSSARY_FP),
    meta.put(toWorkspaceMeta({ ...snapshot, savedAt: Date.now() }), META_WORKSPACE),
  );
  await Promise.all(pending);
  await tx.done;
}

export async function putWorkspaceLines(
  items: readonly LangLine[],
  dirtyIndexes: readonly number[],
  rowIndexes: ReadonlyMap<number, RowIndex>,
  metaPatch?: Partial<WorkspaceMetaRecord> & { glossaries?: readonly GlossaryLike[] },
) {
  const db = await openNecesseDb();
  const tx = db.transaction(["meta", "lines"], "readwrite");
  const lines = tx.objectStore("lines");
  // `dirtyIndexes` are entry ids, which every construction path keeps equal to
  // the row's position in `items` — see `encodeLine`, which stores that position.
  const pending: Promise<unknown>[] = [];
  for (const index of dirtyIndexes) {
    const item = items[index];
    if (!item) continue;
    const idx = item.type === "entry" ? rowIndexes.get(item.id) : undefined;
    pending.push(lines.put(encodeLine(item, index, idx)));
  }
  await Promise.all(pending);
  if (metaPatch) {
    const metaStore = tx.objectStore("meta");
    const current = (await metaStore.get(META_WORKSPACE)) as WorkspaceMetaRecord | undefined;
    if (current) {
      const { glossaries, ...rest } = metaPatch;
      await metaStore.put(
        {
          ...current,
          ...rest,
          savedAt: rest.savedAt ?? Date.now(),
        },
        META_WORKSPACE,
      );
      if (glossaries) {
        await metaStore.put(glossaryFingerprint(glossaries), META_GLOSSARY_FP);
      }
    }
  }
  await tx.done;
}

export async function updateWorkspaceMetaInIdb(
  patch: Partial<WorkspaceMetaRecord>,
  glossaries?: readonly GlossaryLike[],
) {
  const db = await openNecesseDb();
  const tx = db.transaction("meta", "readwrite");
  const current = (await tx.store.get(META_WORKSPACE)) as WorkspaceMetaRecord | undefined;
  if (!current) {
    await tx.done;
    return;
  }
  await tx.store.put(
    { ...current, ...patch, savedAt: patch.savedAt ?? Date.now() },
    META_WORKSPACE,
  );
  if (glossaries) {
    await tx.store.put(glossaryFingerprint(glossaries), META_GLOSSARY_FP);
  }
  await tx.done;
}

export async function loadWorkspaceFromIdb(
  glossaries: readonly GlossaryLike[],
): Promise<LoadedWorkspace> {
  const db = await openNecesseDb();
  const meta = (await db.get("meta", META_WORKSPACE)) as WorkspaceMetaRecord | undefined;
  if (!meta) {
    return { snapshot: null, rowIndexes: new Map(), needsReindexWrite: false };
  }

  const records = (await db.getAll("lines")) as StoredLine[];
  records.sort((a, b) => a.id - b.id);
  const items = records.map(decodeLine);
  assignEntrySections(items);

  const storedSchema = Number((await db.get("meta", META_SCHEMA)) ?? 0);
  const storedIndexer = Number((await db.get("meta", META_INDEXER)) ?? 0);
  const storedFp = String((await db.get("meta", META_GLOSSARY_FP)) ?? "");
  const currentFp = glossaryFingerprint(glossaries);
  const needsReindex =
    storedSchema !== SCHEMA_VERSION || storedIndexer !== INDEXER_VERSION || storedFp !== currentFp;

  let rowIndexes: Map<number, RowIndex>;
  if (needsReindex) {
    rowIndexes = buildRowIndexMap(items, glossaries);
  } else {
    rowIndexes = new Map();
    for (const record of records) {
      if (record.kind === "entry") {
        rowIndexes.set(record.id, record.idx);
      }
    }
  }

  return {
    snapshot: fromWorkspaceMeta(meta, items),
    rowIndexes,
    needsReindexWrite: needsReindex,
  };
}

/**
 * One-shot: copy legacy localStorage progress into IndexedDB when IDB has no workspace.
 * Clears the LS progress key after a successful copy (or when IDB already has data).
 */
export async function migrateProgressFromLocalStorage(
  glossaries: readonly GlossaryLike[],
): Promise<WorkspaceSnapshot | null> {
  const db = await openNecesseDb();
  const existing = await db.get("meta", META_WORKSPACE);
  const legacy = loadProgressFromLocalStorage();

  if (existing) {
    // IDB already authoritative — drop leftover LS blob if any.
    if (legacy) clearProgressFromLocalStorage();
    return null;
  }

  if (!legacy) return null;

  const rowIndexes = buildRowIndexMap(legacy.items, glossaries);
  await replaceWorkspaceInIdb(legacy, rowIndexes, glossaries);
  clearProgressFromLocalStorage();
  return legacy;
}
