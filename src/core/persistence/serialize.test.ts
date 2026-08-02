import { describe, expect, it } from "vitest";

import { deserializeProgress, serializeProgress } from "./serialize";

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
