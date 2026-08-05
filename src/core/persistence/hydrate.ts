// SPDX-License-Identifier: AGPL-3.0-or-later
import { migrateGlossariesFromLocalStorage, type StoredGlossary } from "./glossary-store";
import {
  loadWorkspaceFromIdb,
  migrateProgressFromLocalStorage,
  replaceWorkspaceInIdb,
} from "./progress-store";
import type { WorkspaceSnapshot } from "./serialize";
import type { RowIndex } from "./row-index";

export interface HydratedPersistence {
  glossaries: StoredGlossary[];
  pendingRecovery: WorkspaceSnapshot | null;
  rowIndexes: Map<number, RowIndex>;
}

/**
 * Migrate legacy LS → IDB (once), then load glossaries + optional recovery snapshot.
 * Reindex writes are kicked off in the background so the UI can mount on loaded data.
 */
export async function hydratePersistence(): Promise<HydratedPersistence> {
  const glossaries = await migrateGlossariesFromLocalStorage();
  await migrateProgressFromLocalStorage(glossaries);

  const loaded = await loadWorkspaceFromIdb(glossaries);
  if (loaded.snapshot && loaded.needsReindexWrite) {
    void replaceWorkspaceInIdb(loaded.snapshot, loaded.rowIndexes, glossaries);
  }

  return {
    glossaries,
    pendingRecovery: loaded.snapshot,
    rowIndexes: loaded.rowIndexes,
  };
}
