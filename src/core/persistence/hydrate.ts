// SPDX-License-Identifier: AGPL-3.0-or-later
import { migrateGlossariesFromLocalStorage, type StoredGlossary } from "./glossary-store";
import {
  loadWorkspaceFromIdb,
  migrateProgressFromLocalStorage,
  replaceWorkspaceInIdb,
} from "./progress-store";
import {
  applyPendingMirror,
  clearPendingMirror,
  findEntryById,
  readPendingMirror,
} from "./pending-mirror";
import type { WorkspaceSnapshot } from "./serialize";
import { indexEntry, type RowIndex } from "./row-index";

export interface HydratedPersistence {
  glossaries: StoredGlossary[];
  pendingRecovery: WorkspaceSnapshot | null;
  rowIndexes: Map<number, RowIndex>;
}

/**
 * Migrate legacy LS → IDB (once), replay any edits the last unload could not
 * commit, then load glossaries + optional recovery snapshot.
 * Plain reindex writes are kicked off in the background so the UI can mount on
 * loaded data; a replayed mirror is awaited, since dropping it would lose work.
 */
export async function hydratePersistence(): Promise<HydratedPersistence> {
  const glossaries = await migrateGlossariesFromLocalStorage();
  await migrateProgressFromLocalStorage(glossaries);

  const loaded = await loadWorkspaceFromIdb(glossaries);
  let needsWrite = loaded.needsReindexWrite;

  if (loaded.snapshot) {
    const mirror = readPendingMirror();
    if (mirror) {
      const replayed = applyPendingMirror(loaded.snapshot, mirror);
      for (const id of replayed) {
        const entry = findEntryById(loaded.snapshot.items, id);
        if (entry) loaded.rowIndexes.set(id, indexEntry(entry, glossaries));
      }
      if (replayed.length) {
        await replaceWorkspaceInIdb(loaded.snapshot, loaded.rowIndexes, glossaries);
        needsWrite = false;
      }
      clearPendingMirror();
    }
  } else {
    // Nothing to replay onto — a mirror without a workspace is stale by definition.
    clearPendingMirror();
  }

  if (loaded.snapshot && needsWrite) {
    void replaceWorkspaceInIdb(loaded.snapshot, loaded.rowIndexes, glossaries).catch(() => {
      /* the workspace is still usable in memory; the next save retries */
    });
  }

  return {
    glossaries,
    pendingRecovery: loaded.snapshot,
    rowIndexes: loaded.rowIndexes,
  };
}
