// SPDX-License-Identifier: AGPL-3.0-or-later
import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LangLine } from "@/core/lang/markers";
import { decodeLine, encodeLine } from "./line-codec";
import { DB_NAME, closeNecesseDb, resetNecesseDbCache } from "./idb";
import {
  buildRowIndexMap,
  glossaryFingerprint,
  indexEntry,
  INDEXER_VERSION,
  reindexOne,
} from "./row-index";
import {
  loadWorkspaceFromIdb,
  migrateProgressFromLocalStorage,
  replaceWorkspaceInIdb,
} from "./progress-store";
import {
  GLOSSARY_STORAGE_KEY,
  migrateGlossariesFromLocalStorage,
  type StoredGlossary,
} from "./glossary-store";
import { hydratePersistence } from "./hydrate";
import { PROGRESS_STORAGE_KEY, serializeProgress } from "./serialize";

function memoryLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

const sampleEntry = (overrides: Partial<Extract<LangLine, { type: "entry" }>> = {}) =>
  ({
    type: "entry" as const,
    id: 0,
    key: "hello",
    english: "Hello",
    value: "Hello",
    markedSame: false,
    wasMissing: true,
    touched: false,
    mtDraft: false,
    ...overrides,
  }) satisfies Extract<LangLine, { type: "entry" }>;

const sampleGlossary = (overrides: Partial<StoredGlossary> = {}): StoredGlossary => ({
  format: "necesse-glossary",
  version: 1,
  id: "test-glossary",
  name: "Test",
  sourceLanguage: "en",
  targetLanguage: "ru",
  game: "necesse",
  authors: [],
  updatedAt: "2024-01-01",
  entries: [
    {
      source: "Hello",
      target: "Здравствуйте",
      forms: [],
      alternatives: [],
      forbidden: [],
      caseSensitive: false,
      wholeWord: true,
      status: "approved",
      category: "",
      context: "",
      note: "",
    },
  ],
  enabled: true,
  ...overrides,
});

beforeEach(async () => {
  vi.stubGlobal("localStorage", memoryLocalStorage());
  await closeNecesseDb();
  await deleteDB(DB_NAME);
  resetNecesseDbCache();
});

afterEach(async () => {
  await closeNecesseDb();
  vi.unstubAllGlobals();
});

describe("line codec (internal IDB only)", () => {
  it("records hasRef=false and omits same-language english/ref", () => {
    const encoded = encodeLine(
      sampleEntry({ english: "Привет", value: "Привет", ref: undefined }),
      0,
      {
        status: "done",
        tokenIssue: false,
        wsIssue: false,
        glossaryIssue: false,
        hasRef: false,
      },
    );
    expect(encoded.kind).toBe("entry");
    if (encoded.kind !== "entry") return;
    expect(encoded.hasRef).toBe(false);
    expect(encoded.english).toBeUndefined();
    expect(encoded.ref).toBeUndefined();

    const decoded = decodeLine(encoded);
    expect(decoded).toMatchObject({
      type: "entry",
      english: "Привет",
      value: "Привет",
    });
    expect(decoded.type === "entry" && decoded.ref).toBeUndefined();
  });

  it("stores ref when hasRef and omits english when equal to value", () => {
    const encoded = encodeLine(sampleEntry({ english: "Hello", value: "Hello", ref: "Hello" }), 0, {
      status: "missing",
      tokenIssue: false,
      wsIssue: false,
      glossaryIssue: false,
      hasRef: true,
    });
    expect(encoded.kind).toBe("entry");
    if (encoded.kind !== "entry") return;
    expect(encoded.hasRef).toBe(true);
    expect(encoded.ref).toBe("Hello");
    expect(encoded.english).toBeUndefined();
  });

  it("keeps distinct english without inventing a ref", () => {
    const encoded = encodeLine(
      sampleEntry({ english: "Hello", value: "Привет", wasMissing: true }),
      0,
    );
    expect(encoded.kind).toBe("entry");
    if (encoded.kind !== "entry") return;
    expect(encoded.hasRef).toBe(false);
    expect(encoded.english).toBe("Hello");
    expect(encoded.ref).toBeUndefined();
  });
});

describe("row index", () => {
  it("indexes status and glossary issues for one entry", () => {
    const entry = sampleEntry({ value: "Hi", english: "Hello", ref: "Hello", wasMissing: true });
    const indexed = indexEntry(entry, [sampleGlossary()]);
    expect(indexed.status).toBe("done");
    expect(indexed.hasRef).toBe(true);
    expect(indexed.glossaryIssue).toBe(true);
  });

  it("reindexOne updates only the targeted id", () => {
    const items: LangLine[] = [
      sampleEntry({ id: 0, key: "a", value: "", english: "A", wasMissing: true }),
      sampleEntry({ id: 1, key: "b", value: "B", english: "B", wasMissing: false }),
    ];
    const map = buildRowIndexMap(items, []);
    expect(map.get(0)?.status).toBe("missing");
    expect(map.get(1)?.status).toBe("done");

    const updated = { ...items[1], value: "" } as Extract<LangLine, { type: "entry" }>;
    reindexOne(map, updated, []);
    expect(map.get(0)?.status).toBe("missing");
    expect(map.get(1)?.status).toBe("missing");
  });

  it("glossaryFingerprint changes when enabled set changes", () => {
    const a = glossaryFingerprint([sampleGlossary({ enabled: true })]);
    const b = glossaryFingerprint([sampleGlossary({ enabled: false })]);
    expect(a).not.toBe(b);
    expect(b).toBe("empty");
  });
});

describe("IndexedDB migration and reload", () => {
  it("migrates progress and glossaries from localStorage once", async () => {
    const snapshot = {
      filename: "bg.lang",
      referenceFilename: "en.lang",
      eol: "\n" as const,
      savedAt: 1,
      items: [
        sampleEntry({
          id: 0,
          value: "Здравей",
          english: "Hello",
          ref: "Hello",
          wasMissing: true,
          touched: true,
        }),
      ],
      meta: {
        provider: "google",
        targetLanguage: "bg",
        spellcheck: true,
        autocompleteEnabled: true,
      },
    };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(serializeProgress(snapshot)));
    localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify([sampleGlossary()]));

    const hydrated = await hydratePersistence();
    expect(hydrated.glossaries).toHaveLength(1);
    expect(hydrated.pendingRecovery?.filename).toBe("bg.lang");
    expect(hydrated.rowIndexes.get(0)?.hasRef).toBe(true);
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(GLOSSARY_STORAGE_KEY)).toBeNull();

    // Second hydrate is idempotent and does not require LS.
    await closeNecesseDb();
    const again = await hydratePersistence();
    expect(again.pendingRecovery?.filename).toBe("bg.lang");
    expect(again.glossaries[0]?.id).toBe("test-glossary");
  });

  it("reindexes when indexer version fingerprint mismatches", async () => {
    const items: LangLine[] = [
      sampleEntry({ id: 0, value: "Hi", english: "Hello", ref: "Hello", wasMissing: true }),
    ];
    const glossaries = [sampleGlossary()];
    const indexes = buildRowIndexMap(items, []);
    // Stale index claims no glossary issue.
    indexes.set(0, {
      status: "done",
      tokenIssue: false,
      wsIssue: false,
      glossaryIssue: false,
      hasRef: true,
    });

    await replaceWorkspaceInIdb(
      {
        filename: "x.lang",
        referenceFilename: "en.lang",
        eol: "\n",
        savedAt: 1,
        items,
        meta: {
          provider: "google",
          targetLanguage: "ru",
          spellcheck: true,
          autocompleteEnabled: true,
        },
      },
      indexes,
      [], // fingerprint "empty" stored
    );

    // Load with glossary enabled → fingerprint mismatch → reindex.
    const loaded = await loadWorkspaceFromIdb(glossaries);
    expect(loaded.needsReindexWrite).toBe(true);
    expect(loaded.rowIndexes.get(0)?.glossaryIssue).toBe(true);
    expect(INDEXER_VERSION).toBeGreaterThan(0);
  });

  it("migrateProgressFromLocalStorage is a no-op when IDB already has workspace", async () => {
    const items: LangLine[] = [sampleEntry({ id: 0 })];
    await replaceWorkspaceInIdb(
      {
        filename: "idb.lang",
        referenceFilename: "",
        eol: "\n",
        savedAt: 1,
        items,
        meta: {
          provider: "google",
          targetLanguage: "",
          spellcheck: true,
          autocompleteEnabled: true,
        },
      },
      buildRowIndexMap(items, []),
      [],
    );

    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(
        serializeProgress({
          filename: "legacy.lang",
          referenceFilename: "",
          eol: "\n",
          savedAt: 1,
          items,
          meta: {
            provider: "google",
            targetLanguage: "",
            spellcheck: true,
            autocompleteEnabled: true,
          },
        }),
      ),
    );

    const migrated = await migrateProgressFromLocalStorage([]);
    expect(migrated).toBeNull();
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();

    const loaded = await loadWorkspaceFromIdb([]);
    expect(loaded.snapshot?.filename).toBe("idb.lang");
  });

  it("migrateGlossariesFromLocalStorage prefers existing IDB rows", async () => {
    localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify([sampleGlossary({ id: "legacy" })]));
    // Seed IDB first via migrate of empty then save — use hydrate path after writing LS only.
    // Write IDB glossary by migrating once, then put different LS and migrate again.
    await migrateGlossariesFromLocalStorage();
    expect(localStorage.getItem(GLOSSARY_STORAGE_KEY)).toBeNull();

    localStorage.setItem(
      GLOSSARY_STORAGE_KEY,
      JSON.stringify([sampleGlossary({ id: "newer-ls" })]),
    );
    const again = await migrateGlossariesFromLocalStorage();
    expect(again.map((g) => g.id)).toEqual(["legacy"]);
    expect(localStorage.getItem(GLOSSARY_STORAGE_KEY)).toBeNull();
  });
});
