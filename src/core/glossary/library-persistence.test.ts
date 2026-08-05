// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  GLOSSARY_LIBRARY_STORAGE_KEY,
  loadGlossaryLibrary,
  removeFromGlossaryLibrary,
  saveGlossaryLibrary,
  setGlossaryLibraryEnabled,
  upsertGlossaryLibrary,
} from "./library-persistence";
import { normalizeGlossary } from "./loader";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function glossary(target = "Заселник") {
  return normalizeGlossary({
    format: "necesse-glossary",
    version: 1,
    id: "necesse-bg",
    name: "Bulgarian glossary",
    sourceLanguage: "en",
    targetLanguage: "bg",
    authors: ["Translator"],
    entries: [
      {
        source: "Settler",
        target,
        status: "approved",
        category: "character",
      },
    ],
  });
}

describe("glossary library persistence", () => {
  it("round-trips normalized glossaries and enabled state", () => {
    const storage = new MemoryStorage();
    const library = [{ ...glossary(), enabled: false }];

    expect(saveGlossaryLibrary(library, storage)).toBe(true);
    expect(loadGlossaryLibrary(storage)).toEqual(library);
  });

  it("keeps valid entries when another stored glossary is damaged", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      GLOSSARY_LIBRARY_STORAGE_KEY,
      JSON.stringify([{ ...glossary(), enabled: true }, { id: "broken" }]),
    );

    expect(loadGlossaryLibrary(storage).map((item) => item.id)).toEqual(["necesse-bg"]);
  });

  it("preserves activation while replacing a locally saved glossary", () => {
    const original = [{ ...glossary(), enabled: false }];
    const updated = upsertGlossaryLibrary(original, glossary("Колонист"));

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ enabled: false, entries: [{ target: "Колонист" }] });
  });

  it("provides immutable enable and remove transitions", () => {
    const original = [{ ...glossary(), enabled: true }];
    const disabled = setGlossaryLibraryEnabled(original, "necesse-bg", false);
    const removed = removeFromGlossaryLibrary(disabled, "necesse-bg");

    expect(original[0].enabled).toBe(true);
    expect(disabled[0].enabled).toBe(false);
    expect(removed).toEqual([]);
  });
});
