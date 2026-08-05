// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LangLine } from "@/core/lang/markers";
import type { WorkspaceSnapshot } from "./serialize";

/**
 * Synchronous last-resort mirror for edits the debounced IndexedDB write has
 * not committed yet.
 *
 * IndexedDB is asynchronous, and a transaction opened while the page is going
 * away is not guaranteed to commit — so every time the page is hidden the
 * still-dirty rows are also written to localStorage, synchronously, where they
 * survive the unload. Only the dirty delta is mirrored (a handful of rows),
 * never the whole file, so this stays far below the localStorage quota that
 * motivated the move to IndexedDB in the first place.
 */
export const PENDING_MIRROR_KEY = "necesse_lang_translator_pending_v1";

export interface MirroredEdit {
  id: number;
  value: string;
  markedSame: boolean;
  touched: boolean;
  mtDraft: boolean;
}

export interface PendingMirror {
  filename: string;
  savedAt: number;
  edits: MirroredEdit[];
}

type EntryLine = Extract<LangLine, { type: "entry" }>;

/** Entry ids are array positions in every construction path — verify, then scan. */
export function findEntryById(items: readonly LangLine[], id: number): EntryLine | undefined {
  const positional = items[id];
  if (positional?.type === "entry" && positional.id === id) return positional;
  return items.find((item): item is EntryLine => item.type === "entry" && item.id === id);
}

export function writePendingMirror(
  filename: string,
  items: readonly LangLine[],
  dirtyIds: Iterable<number>,
): void {
  const edits: MirroredEdit[] = [];
  for (const id of dirtyIds) {
    const entry = findEntryById(items, id);
    if (!entry) continue;
    edits.push({
      id,
      value: entry.value,
      markedSame: entry.markedSame,
      touched: entry.touched,
      mtDraft: !!entry.mtDraft,
    });
  }
  if (!edits.length) {
    clearPendingMirror();
    return;
  }
  try {
    localStorage.setItem(
      PENDING_MIRROR_KEY,
      JSON.stringify({ filename, savedAt: Date.now(), edits } satisfies PendingMirror),
    );
  } catch {
    /* the IndexedDB write is still the primary path */
  }
}

export function readPendingMirror(): PendingMirror | null {
  try {
    const raw = localStorage.getItem(PENDING_MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingMirror;
    if (!parsed || !Array.isArray(parsed.edits)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingMirror(): void {
  try {
    localStorage.removeItem(PENDING_MIRROR_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Replay mirrored edits onto a snapshot loaded from IndexedDB.
 * Returns the ids that were actually changed, so only those rows get reindexed.
 */
export function applyPendingMirror(snapshot: WorkspaceSnapshot, mirror: PendingMirror): number[] {
  if (mirror.filename !== snapshot.filename) return [];
  const applied: number[] = [];
  for (const edit of mirror.edits) {
    const entry = findEntryById(snapshot.items, edit.id);
    if (!entry) continue;
    if (
      entry.value === edit.value &&
      entry.markedSame === edit.markedSame &&
      entry.touched === edit.touched &&
      !!entry.mtDraft === edit.mtDraft
    ) {
      continue;
    }
    entry.value = edit.value;
    entry.markedSame = edit.markedSame;
    entry.touched = edit.touched;
    entry.mtDraft = edit.mtDraft;
    applied.push(edit.id);
  }
  return applied;
}
