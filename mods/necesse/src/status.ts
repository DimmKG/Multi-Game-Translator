// SPDX-License-Identifier: AGPL-3.0-or-later
import type { EntryStatus, StatusStrategy, TranslationEntry } from "@mgt/sdk";

/**
 * Necesse-specific fields the generic ini File Loader/TranslationEntry model
 * has no place for — stashed in entry.ext, read back on export. originalValue
 * is the RHS as parsed (frozen at parse time), used only to detect "still
 * untouched since it was flagged missing" — distinct from entry.source, which
 * may instead hold a matched reference value.
 */
export type NecesseEntryExt = {
  markedSame: boolean;
  wasMissing: boolean;
  originalValue: string;
  /** Whether this entry was actually matched against a loaded reference file. */
  hasReference: boolean;
};

export interface NecesseNativeState {
  markedSame: boolean;
  wasMissing: boolean;
  hasReference: boolean;
}

/**
 * Validates entry.ext actually has the shape necesseGameLoader.toDocument()
 * produces before trusting it — an unchecked cast here degrades to silently
 * wrong output (e.g. a dropped/garbled status marker) instead of a clear error.
 * Exported so host code reading entry.ext (outside this module's own
 * fromNative/toNative) gets the same validation instead of a bare cast.
 */
export function necesseEntryExt(entry: TranslationEntry): NecesseEntryExt {
  const value = entry.ext;
  if (
    typeof value?.markedSame !== "boolean" ||
    typeof value.wasMissing !== "boolean" ||
    typeof value.originalValue !== "string" ||
    typeof value.hasReference !== "boolean"
  ) {
    throw new TypeError(
      `Entry "${entry.id}" is missing the Necesse ext fields (markedSame/wasMissing/originalValue/hasReference) — was it produced by necesseGameLoader.toDocument()?`,
    );
  }
  return value as NecesseEntryExt;
}

/**
 * Mirrors today's statusOf(): SAME_TRANSLATION is only a verified "same" once
 * a reference is matched; a MISSING_TRANSLATION entry stays "missing" until
 * its text actually diverges from the original (frozen) RHS.
 */
export const necesseStatusStrategy: StatusStrategy = {
  fromNative(entry, nativeState) {
    const state = nativeState as NecesseNativeState;
    if (state.markedSame && state.hasReference) return "same";
    if (state.wasMissing) {
      const untouched =
        entry.target.trim() === "" || entry.target === necesseEntryExt(entry).originalValue;
      return untouched ? "missing" : "translated";
    }
    return entry.target.trim() === "" ? "missing" : "translated";
  },

  /**
   * Mirrors today's buildLangFile(): an explicit SAME_TRANSLATION marker is
   * preserved regardless of computed status; otherwise "missing" re-emits the
   * MISSING_TRANSLATION prefix, and anything else gets no prefix at all.
   */
  toNative(entry, status: EntryStatus) {
    if (necesseEntryExt(entry).markedSame) return "same";
    if (status === "missing") return "missing";
    return "none";
  },
};
