// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TranslationDocument } from "@mgt/sdk";
import { describe, expect, it } from "vitest";

import { deserializeProgressV3, serializeProgressV3 } from "./serialize";

describe("progress serialization V3", () => {
  const sampleDocument: TranslationDocument = {
    gameLoaderId: "necesse",
    fileLoaderId: "ini",
    sourceLocale: "en",
    targetLocale: "ru",
    nodes: [
      {
        type: "entry",
        entry: {
          id: "hello:0",
          key: "hello",
          source: "Hello",
          target: "Привет",
          status: "translated",
          ext: {},
        },
      },
    ],
    formatMeta: { eol: "\n", trailingNewline: true },
    gameMeta: {},
  };

  it("round-trips a TranslationDocument-based record, including the active tab", () => {
    const serialized = serializeProgressV3({
      document: sampleDocument,
      uiFlags: { "hello:0": { touched: true, mtDraft: false } },
      filename: "ru.lang",
      referenceFilename: "en.lang",
      view: "review",
      savedAt: 42,
      provider: "google",
      spellcheck: true,
      autocompleteEnabled: false,
    });
    expect(serialized.v).toBe(3);

    const restored = deserializeProgressV3(serialized);
    expect(restored.document).toEqual(sampleDocument);
    expect(restored.uiFlags).toEqual({ "hello:0": { touched: true, mtDraft: false } });
    expect(restored.filename).toBe("ru.lang");
    expect(restored.view).toBe("review");
    expect(restored.savedAt).toBe(42);
  });

  it("falls back to the editor tab for a missing or invalid view", () => {
    expect(deserializeProgressV3({ v: 3, document: sampleDocument }).view).toBe("editor");
    expect(deserializeProgressV3({ v: 3, document: sampleDocument, view: "bogus" }).view).toBe(
      "editor",
    );
  });

  it("rejects a pre-V3 document instead of guessing at compatibility", () => {
    const v2 = { v: 2, f: "bg.lang", e: 0, s: 1, n: "en.lang", m: {}, i: [] };
    expect(() => deserializeProgressV3(v2)).toThrow(/Unknown progress format/);
  });

  it("rejects a record with no document payload", () => {
    expect(() => deserializeProgressV3({ v: 3 })).toThrow(/Unknown progress format/);
  });
});
