// SPDX-License-Identifier: AGPL-3.0-or-later

/** Generic app-level UI vocabulary — game-agnostic, unlike the mod-owned constants this file used to also hold. */
export type EntryStatus = "missing" | "done" | "same";
export type FilterMode = "missing" | "done" | "same" | "all" | "ws";
export type WorkspaceView = "editor" | "review" | "diff" | "terminology";
export type ReviewFilter = "all" | "mt" | "issues" | "same";
export type DiffMode = "word" | "character";
