// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TranslationDocument } from "@mgt/sdk";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { StoredLine } from "./line-codec";
import type { WorkspaceView } from "@/core/lang/markers";
import type { NormalizedGlossary } from "@/core/glossary/loader";
import type { TerminologyCandidate } from "@/core/terminology/extract-candidates";
import type { TerminologyReviewState } from "@/core/terminology/review-persistence";

export const DB_NAME = "necesse-translator";
/** v2 adds the "documents" store (TranslationDocument-based persistence); "lines" is retired once the LangLine-based path is removed. */
export const DB_VERSION = 2;

export interface WorkspaceUiFlags {
  touched: boolean;
  mtDraft: boolean;
}

export interface WorkspaceDocumentRecord {
  document: TranslationDocument;
  uiFlags: Record<string, WorkspaceUiFlags>;
  filename: string;
  referenceFilename: string;
  /** Last active tab — restored on reload so the session resumes exactly where it left off. */
  view: WorkspaceView;
  savedAt: number;
  provider: string;
  spellcheck: boolean;
  autocompleteEnabled: boolean;
}

export interface StoredGlossaryRecord extends NormalizedGlossary {
  enabled: boolean;
}

export interface WorkspaceMetaRecord {
  filename: string;
  referenceFilename: string;
  eol: "\n" | "\r\n";
  savedAt: number;
  provider: string;
  targetLanguage: string;
  spellcheck: boolean;
  autocompleteEnabled: boolean;
}

export interface TerminologyCorpusFileRecord {
  id: string;
  languageCode: string;
  filename: string;
  text: string;
}

export interface TerminologyExtractionRecord {
  sourceLanguageCode: string;
  sourceFile: TerminologyCorpusFileRecord | null;
  translatedFiles: TerminologyCorpusFileRecord[];
  minimumFrequency: number;
  candidates: TerminologyCandidate[];
  reviewState: TerminologyReviewState;
  section: "sources" | "review" | "merge" | "authoring";
  savedAt: number;
}

interface NecesseDb extends DBSchema {
  meta: {
    key: string;
    value: number | string | WorkspaceMetaRecord | TerminologyExtractionRecord;
  };
  lines: {
    key: number;
    value: StoredLine;
    indexes: {
      "by-status": string;
    };
  };
  glossaries: {
    key: string;
    value: StoredGlossaryRecord;
  };
  documents: {
    key: string;
    value: WorkspaceDocumentRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<NecesseDb>> | null = null;

export function openNecesseDb(): Promise<IDBPDatabase<NecesseDb>> {
  if (!dbPromise) {
    const opening = openDB<NecesseDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
        if (!db.objectStoreNames.contains("lines")) {
          const lines = db.createObjectStore("lines", { keyPath: "id" });
          lines.createIndex("by-status", "idx.status");
        }
        if (!db.objectStoreNames.contains("glossaries")) {
          db.createObjectStore("glossaries", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents");
        }
      },
    });
    // A cached rejection would disable persistence for the rest of the session;
    // drop it so the next call gets a fresh attempt.
    const guarded: Promise<IDBPDatabase<NecesseDb>> = opening.catch((error: unknown) => {
      if (dbPromise === guarded) dbPromise = null;
      throw error;
    });
    dbPromise = guarded;
  }
  return dbPromise;
}

/** Close the cached connection so tests can delete the database. */
export async function closeNecesseDb() {
  const pending = dbPromise;
  if (!pending) return;
  dbPromise = null;
  try {
    (await pending).close();
  } catch {
    /* never opened — nothing to close */
  }
}

/** Test helper — drop the cached promise without closing (prefer closeNecesseDb). */
export function resetNecesseDbCache() {
  dbPromise = null;
}
