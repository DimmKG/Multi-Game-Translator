// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TranslationDocument } from "@mgt/sdk";
import { describe, expect, it } from "vitest";

import {
  deserializeProgress,
  deserializeProgressV3,
  serializeProgress,
  serializeProgressV3,
} from "./serialize";

describe("progress serialization", () => {
  it("round-trips v2 snapshots", () => {
    const document = serializeProgress({
      filename: "bg.lang",
      referenceFilename: "en.lang",
      eol: "\n",
      savedAt: 1,
      items: [
        {
          type: "entry",
          id: 0,
          key: "hello",
          english: "Hello",
          value: "Здравей",
          markedSame: false,
          wasMissing: true,
          touched: true,
          mtDraft: false,
          ref: "Hello",
        },
      ],
      meta: {
        provider: "google",
        targetLanguage: "bg",
        spellcheck: true,
        autocompleteEnabled: true,
      },
    });
    const restored = deserializeProgress(document);
    expect(restored.filename).toBe("bg.lang");
    expect(restored.items[0]).toMatchObject({
      type: "entry",
      key: "hello",
      value: "Здравей",
      wasMissing: true,
      touched: true,
      ref: "Hello",
    });
  });

  it("rebuilds entry.section from preserved section headers after restore", () => {
    const document = serializeProgress({
      filename: "bg.lang",
      referenceFilename: "en.lang",
      eol: "\n",
      savedAt: 1,
      items: [
        { type: "section", raw: "[lang]", name: "[lang]" },
        {
          type: "entry",
          id: 1,
          key: "credits",
          english: "By authors",
          value: "Автори",
          markedSame: false,
          wasMissing: false,
          touched: true,
          mtDraft: false,
          section: "[lang]",
        },
        { type: "section", raw: "[tile]", name: "[tile]" },
        {
          type: "entry",
          id: 3,
          key: "watertile",
          english: "Water",
          value: "Вода",
          markedSame: false,
          wasMissing: false,
          touched: false,
          mtDraft: false,
          section: "[tile]",
        },
      ],
      meta: {
        provider: "google",
        targetLanguage: "bg",
        spellcheck: true,
        autocompleteEnabled: true,
      },
    });

    // Compact v2 rows never store section on entries — only the header lines.
    expect(document.i[1]).toEqual(expect.any(Array));

    const restored = deserializeProgress(document);
    expect(restored.items[1]).toMatchObject({
      type: "entry",
      key: "credits",
      section: "[lang]",
    });
    expect(restored.items[3]).toMatchObject({
      type: "entry",
      key: "watertile",
      section: "[tile]",
    });
  });
});

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

  it("rejects a v2 document instead of guessing at compatibility", () => {
    const v2 = serializeProgress({
      filename: "bg.lang",
      referenceFilename: "en.lang",
      eol: "\n",
      savedAt: 1,
      items: [],
      meta: {
        provider: "google",
        targetLanguage: "bg",
        spellcheck: true,
        autocompleteEnabled: true,
      },
    });
    expect(() => deserializeProgressV3(v2)).toThrow(/Unknown progress format/);
  });

  it("rejects a record with no document payload", () => {
    expect(() => deserializeProgressV3({ v: 3 })).toThrow(/Unknown progress format/);
  });
});
