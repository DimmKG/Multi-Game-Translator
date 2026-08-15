// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TranslationDocument } from "@mgt/sdk";
import type { WorkspaceView } from "@/core/lang/markers";
import type { WorkspaceDocumentRecord, WorkspaceUiFlags } from "./idb";

/**
 * V3 — user-facing progress-file format wrapping a TranslationDocument
 * directly. No app has ever shipped with real user data, so there is no
 * older format to read back — this is unrelated to the IndexedDB autosave
 * shape (see ./document-store.ts).
 */
const WORKSPACE_VIEWS: readonly WorkspaceView[] = ["editor", "review", "diff", "terminology"];

function isWorkspaceView(value: unknown): value is WorkspaceView {
  return typeof value === "string" && (WORKSPACE_VIEWS as readonly string[]).includes(value);
}

export interface ProgressDocumentV3 {
  v: 3;
  savedAt: number;
  filename: string;
  referenceFilename: string;
  /** Last active tab — restored on load so the session resumes where it left off. */
  view: WorkspaceView;
  provider: string;
  spellcheck: boolean;
  autocompleteEnabled: boolean;
  document: TranslationDocument;
  uiFlags: Record<string, WorkspaceUiFlags>;
}

export function serializeProgressV3(record: WorkspaceDocumentRecord): ProgressDocumentV3 {
  return {
    v: 3,
    savedAt: record.savedAt,
    filename: record.filename,
    referenceFilename: record.referenceFilename,
    view: record.view,
    provider: record.provider,
    spellcheck: record.spellcheck,
    autocompleteEnabled: record.autocompleteEnabled,
    document: record.document,
    uiFlags: record.uiFlags,
  };
}

export function deserializeProgressV3(data: unknown): WorkspaceDocumentRecord {
  if (!data || typeof data !== "object") throw new Error("Unknown progress format");
  const doc = data as Record<string, unknown>;
  if (doc.v !== 3) throw new Error("Unknown progress format");
  if (!doc.document || typeof doc.document !== "object") {
    throw new Error("Unknown progress format");
  }
  const uiFlags =
    doc.uiFlags && typeof doc.uiFlags === "object"
      ? (doc.uiFlags as Record<string, WorkspaceUiFlags>)
      : {};
  return {
    document: doc.document as TranslationDocument,
    uiFlags,
    filename: String(doc.filename || ""),
    referenceFilename: String(doc.referenceFilename || ""),
    view: isWorkspaceView(doc.view) ? doc.view : "editor",
    savedAt: Number(doc.savedAt || 0),
    provider: String(doc.provider || "google"),
    spellcheck: doc.spellcheck !== false,
    autocompleteEnabled: doc.autocompleteEnabled !== false,
  };
}
