// SPDX-License-Identifier: AGPL-3.0-or-later
import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeNecesseDb, DB_NAME, resetNecesseDbCache } from "./idb";
import {
  GLOSSARY_STORAGE_KEY,
  migrateGlossariesFromLocalStorage,
  type StoredGlossary,
} from "./glossary-store";

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

const sampleGlossary = (overrides: Partial<StoredGlossary> = {}): StoredGlossary => ({
  format: "necesse-glossary",
  version: 2,
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
      includeRegex: "",
      excludeRegex: "",
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

describe("migrateGlossariesFromLocalStorage", () => {
  it("prefers existing IDB rows over a legacy localStorage blob", async () => {
    localStorage.setItem(GLOSSARY_STORAGE_KEY, JSON.stringify([sampleGlossary({ id: "legacy" })]));
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
