// SPDX-License-Identifier: AGPL-3.0-or-later
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { StoredLine } from "./line-codec";
import type { NormalizedGlossary } from "@/core/glossary/loader";

export const DB_NAME = "necesse-translator";
export const DB_VERSION = 1;

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

interface NecesseDb extends DBSchema {
  meta: {
    key: string;
    value: number | string | WorkspaceMetaRecord;
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
}

let dbPromise: Promise<IDBPDatabase<NecesseDb>> | null = null;

export function openNecesseDb(): Promise<IDBPDatabase<NecesseDb>> {
  if (!dbPromise) {
    dbPromise = openDB<NecesseDb>(DB_NAME, DB_VERSION, {
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
      },
    });
  }
  return dbPromise;
}

/** Close the cached connection so tests can delete the database. */
export async function closeNecesseDb() {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

/** Test helper — drop the cached promise without closing (prefer closeNecesseDb). */
export function resetNecesseDbCache() {
  dbPromise = null;
}
