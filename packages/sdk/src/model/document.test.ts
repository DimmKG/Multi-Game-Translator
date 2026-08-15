// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { ENTRY_STATUSES, type TranslationDocument, type TranslationEntry } from "./document";

describe("ENTRY_STATUSES", () => {
  it("is the fixed 6-state lifecycle", () => {
    expect(ENTRY_STATUSES).toEqual(["new", "missing", "draft", "translated", "same", "reviewed"]);
  });
});

describe("TranslationDocument shape", () => {
  it("accepts a minimal well-formed document", () => {
    const entry: TranslationEntry = {
      id: "section:key#0",
      namespace: "section",
      key: "key",
      source: "Hello",
      target: "",
      status: "missing",
      ext: {},
    };

    const doc: TranslationDocument = {
      gameLoaderId: "generic-ini",
      fileLoaderId: "ini",
      sourceLocale: "en",
      targetLocale: "ru",
      nodes: [
        { type: "section", raw: "[section]", name: "section" },
        { type: "entry", entry },
      ],
      formatMeta: {},
      gameMeta: {},
    };

    expect(doc.nodes).toHaveLength(2);
  });

  it("allows plural forms only when explicitly populated", () => {
    const entry: TranslationEntry = {
      id: "ui:apple-count#0",
      key: "apple-count",
      source: "{count} apples",
      sourcePlurals: { one: "{count} apple", other: "{count} apples" },
      target: "",
      targetPlurals: { one: "", few: "", many: "", other: "" },
      status: "new",
      ext: {},
    };

    expect(entry.sourcePlurals?.one).toBe("{count} apple");
    expect(Object.keys(entry.targetPlurals ?? {})).toEqual(["one", "few", "many", "other"]);
  });
});
