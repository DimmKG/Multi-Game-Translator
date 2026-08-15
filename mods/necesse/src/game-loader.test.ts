// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  iniFileLoader,
  type DocumentNode,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";
import { describe, expect, it } from "vitest";
import { necesseGameLoader } from "./game-loader";
import { necesseStatusStrategy, type NecesseEntryExt } from "./status";

function toDoc(
  files: Array<{ name: string; text: string }>,
  roles: Array<{ role: string }>,
  targetLocale = "ru",
): TranslationDocument {
  const raw = iniFileLoader.parse({ files });
  return necesseGameLoader.toDocument(raw, roles, targetLocale);
}

function entries(doc: TranslationDocument): TranslationEntry[] {
  return doc.nodes
    .filter((node): node is Extract<DocumentNode, { type: "entry" }> => node.type === "entry")
    .map((node) => node.entry);
}

describe("necesseGameLoader.toDocument", () => {
  it("preserves sections, markers and CRLF", () => {
    const doc = toDoc(
      [
        {
          name: "t.lang",
          text: "[misc]\r\nMISSING_TRANSLATION:hello=Hello\r\nSAME_TRANSLATION:bye=Bye\r\n",
        },
      ],
      [{ role: "translation" }],
    );

    expect(doc.formatMeta).toMatchObject({ eol: "\r\n" });
    expect(doc.nodes[0]).toMatchObject({ type: "section", name: "misc" });

    const [hello, bye] = entries(doc);
    expect(hello).toMatchObject({ key: "hello", target: "Hello", status: "missing" });
    // No reference loaded — SAME_TRANSLATION alone is not a verified "same" (see reference-status below).
    expect(bye).toMatchObject({ key: "bye", target: "Bye", status: "translated" });
  });

  it("matches by key while ignoring divergent comments", () => {
    const doc = toDoc(
      [
        {
          name: "en.lang",
          text: [
            "// reference-only header",
            "// another ref comment",
            "[tile]",
            "watertile=Water",
            "// ref lore between tiles",
            "",
            "grasstile=Grass",
            "// trailing ref comment",
            "",
          ].join("\n"),
        },
        {
          name: "t.lang",
          text: [
            "// target-only header",
            "[tile]",
            "// translator note before water",
            "watertile=Wasser",
            "",
            "// spacer comment",
            "grasstile=Gras",
            "",
          ].join("\n"),
        },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );

    expect(entries(doc)).toEqual([
      expect.objectContaining({
        key: "watertile",
        target: "Wasser",
        source: "Water",
        namespace: "tile",
      }),
      expect.objectContaining({
        key: "grasstile",
        target: "Gras",
        source: "Grass",
        namespace: "tile",
      }),
    ]);
  });

  it("keeps duplicate keys in different sections distinct", () => {
    const doc = toDoc(
      [
        {
          name: "en.lang",
          text: [
            "[item]",
            "title=Item Title",
            "// only in reference",
            "[npc]",
            "title=Npc Title",
            "",
          ].join("\n"),
        },
        {
          name: "t.lang",
          text: [
            "[item]",
            "// item note",
            "title=Gegenstandstitel",
            "[npc]",
            "// npc note — shifts line indexes vs reference",
            "title=NSC-Titel",
            "",
          ].join("\n"),
        },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );

    const items = entries(doc);
    expect(items.find((entry) => entry.namespace === "item")?.source).toBe("Item Title");
    expect(items.find((entry) => entry.namespace === "npc")?.source).toBe("Npc Title");
  });

  it("matches duplicate keys inside one section by occurrence order", () => {
    const doc = toDoc(
      [
        { name: "en.lang", text: "[misc]\na=one\na=two\n" },
        { name: "t.lang", text: "[misc]\na=eins\na=zwei\n" },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );

    const items = entries(doc);
    expect(items.map((entry) => entry.source)).toEqual(["one", "two"]);
    expect(items.map((entry) => entry.target)).toEqual(["eins", "zwei"]);
    // Distinct ids despite the shared (namespace, key) pair.
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });
});

describe("reference-dependent status", () => {
  it("SAME marker is only a same status once a reference is matched", () => {
    const withoutRef = toDoc(
      [{ name: "t.lang", text: "SAME_TRANSLATION:hello=Hello\n" }],
      [{ role: "translation" }],
    );
    expect(entries(withoutRef)[0]?.status).toBe("translated");

    const withRef = toDoc(
      [
        { name: "en.lang", text: "hello=Hello\n" },
        { name: "t.lang", text: "SAME_TRANSLATION:hello=Hello\n" },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );
    expect(entries(withRef)[0]?.status).toBe("same");
  });

  it("hasReference in ext reflects whether a reference actually matched this entry", () => {
    const doc = toDoc(
      [
        { name: "en.lang", text: "hello=Hello\n" },
        { name: "t.lang", text: "hello=Hallo\nbye=Bye\n" },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );
    const [hello, bye] = entries(doc);
    expect((hello?.ext as NecesseEntryExt).hasReference).toBe(true);
    expect((bye?.ext as NecesseEntryExt).hasReference).toBe(false);
  });
});

describe("necesseGameLoader.fromDocument", () => {
  it("round-trips a document with no reference, no edits, byte-for-byte", () => {
    const text = "[misc]\nMISSING_TRANSLATION:hello=Hello\nSAME_TRANSLATION:bye=Bye\n";
    const doc = toDoc([{ name: "t.lang", text }], [{ role: "translation" }]);
    const raw = necesseGameLoader.fromDocument(doc);
    const output = iniFileLoader.serialize(raw);
    expect(output.files[0]?.text).toBe(text);
  });

  it("re-emits SAME_TRANSLATION when an entry is marked same after matching a reference", () => {
    const doc = toDoc(
      [
        { name: "en.lang", text: "hello=Hello\nbye=Bye\n" },
        { name: "t.lang", text: "hello=Hallo\nbye=Bye\n" },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );

    const [hello] = entries(doc);
    if (!hello) throw new Error("expected an entry");
    (hello.ext as NecesseEntryExt).markedSame = true;
    hello.status = necesseStatusStrategy.fromNative(hello, {
      markedSame: true,
      wasMissing: false,
      hasReference: true,
    });
    expect(hello.status).toBe("same");

    const raw = necesseGameLoader.fromDocument(doc);
    const output = iniFileLoader.serialize(raw);
    expect(output.files[0]?.text).toContain("SAME_TRANSLATION:hello=Hallo");
  });

  it("re-emits MISSING_TRANSLATION for an entry that is still untouched", () => {
    const doc = toDoc(
      [{ name: "t.lang", text: "MISSING_TRANSLATION:hello=Hello\n" }],
      [{ role: "translation" }],
    );
    const raw = necesseGameLoader.fromDocument(doc);
    const output = iniFileLoader.serialize(raw);
    expect(output.files[0]?.text).toBe("MISSING_TRANSLATION:hello=Hello\n");
  });

  it("drops the MISSING_TRANSLATION prefix once the translator edits the text", () => {
    const doc = toDoc(
      [{ name: "t.lang", text: "MISSING_TRANSLATION:hello=Hello\n" }],
      [{ role: "translation" }],
    );
    const [hello] = entries(doc);
    if (!hello) throw new Error("expected an entry");
    hello.target = "Hallo";
    hello.status = necesseStatusStrategy.fromNative(hello, {
      markedSame: false,
      wasMissing: true,
      hasReference: false,
    });
    expect(hello.status).toBe("translated");

    const raw = necesseGameLoader.fromDocument(doc);
    const output = iniFileLoader.serialize(raw);
    expect(output.files[0]?.text).toBe("hello=Hallo\n");
  });

  it("preserves a mixed-EOL-free file without a trailing newline", () => {
    const text = "key=value";
    const doc = toDoc([{ name: "t.lang", text }], [{ role: "translation" }]);
    const raw = necesseGameLoader.fromDocument(doc);
    const output = iniFileLoader.serialize(raw);
    expect(output.files[0]?.text).toBe(text);
  });

  it("throws instead of silently corrupting output when formatMeta is foreign/malformed", () => {
    const doc = toDoc([{ name: "t.lang", text: "key=value\n" }], [{ role: "translation" }]);
    const foreign: TranslationDocument = { ...doc, formatMeta: {} };
    expect(() => necesseGameLoader.fromDocument(foreign)).toThrow(/formatMeta/);
  });

  it("throws instead of silently corrupting output when an entry's ext is foreign/malformed", () => {
    const doc = toDoc([{ name: "t.lang", text: "key=value\n" }], [{ role: "translation" }]);
    const [hello] = entries(doc);
    if (!hello) throw new Error("expected an entry");
    hello.ext = {};
    expect(() => necesseGameLoader.fromDocument(doc)).toThrow(/ext fields/);
  });
});

describe("necesseGameLoader.detectGame", () => {
  it("scores a file with Necesse markers and engname highly", () => {
    const score = necesseGameLoader.detectGame({
      files: [
        {
          name: "en.lang",
          text: "[lang]\nengname=English\nMISSING_TRANSLATION:hello=Hello\n",
        },
      ],
    });
    expect(score).toBe(1);
  });

  it("scores a non-.lang, marker-free file low", () => {
    const score = necesseGameLoader.detectGame({
      files: [{ name: "notes.txt", text: "just some notes" }],
    });
    expect(score).toBeLessThan(0.5);
  });

  it("returns 0 for an empty file list", () => {
    expect(necesseGameLoader.detectGame({ files: [] })).toBe(0);
  });
});
