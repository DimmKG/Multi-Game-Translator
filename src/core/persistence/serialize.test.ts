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
});
