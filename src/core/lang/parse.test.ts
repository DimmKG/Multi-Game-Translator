// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { buildLangFile } from "./export";
import {
  applyReferenceMap,
  createTranslationFromReference,
  parseLangFile,
  parseReferenceLang,
  referenceIdentity,
} from "./parse";
import { statusOf, type TranslationEntry } from "./status";

describe("parseLangFile", () => {
  it("preserves sections, markers and CRLF", () => {
    const source = "[misc]\r\nMISSING_TRANSLATION:hello=Hello\r\nSAME_TRANSLATION:bye=Bye\r\n";
    const parsed = parseLangFile(source);
    expect(parsed.eol).toBe("\r\n");
    expect(parsed.items[0]).toMatchObject({ type: "section", name: "[misc]" });
    const missing = parsed.items[1];
    const same = parsed.items[2];
    expect(missing).toMatchObject({
      type: "entry",
      key: "hello",
      wasMissing: true,
      value: "Hello",
    });
    expect(same).toMatchObject({ type: "entry", key: "bye", markedSame: true });
    if (missing.type === "entry") expect(statusOf(missing)).toBe("missing");
  });
});

describe("reference and export", () => {
  it("applies reference map and exports markers", () => {
    const parsed = parseLangFile("hello=Hallo\nbye=Bye\n");
    const reference = parseReferenceLang("hello=Hello\nbye=Bye\n");
    const matched = applyReferenceMap(parsed.items, reference);
    expect(matched).toBe(2);
    const hello = parsed.items[0];
    if (hello.type === "entry") {
      hello.markedSame = true;
      expect(statusOf(hello)).toBe("same");
    }
    const exported = buildLangFile(parsed.items, "\n");
    expect(exported).toContain("SAME_TRANSLATION:hello=Hallo");
  });

  it("matches by key while ignoring divergent comments", () => {
    const target = parseLangFile(
      [
        "// target-only header",
        "[tile]",
        "// translator note before water",
        "watertile=Wasser",
        "",
        "// spacer comment",
        "grasstile=Gras",
        "",
      ].join("\n"),
    );
    const reference = parseReferenceLang(
      [
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
    );

    expect(applyReferenceMap(target.items, reference)).toBe(2);
    const entries = target.items.filter((item): item is TranslationEntry => item.type === "entry");
    expect(entries).toEqual([
      expect.objectContaining({
        key: "watertile",
        value: "Wasser",
        ref: "Water",
        section: "[tile]",
      }),
      expect.objectContaining({
        key: "grasstile",
        value: "Gras",
        ref: "Grass",
        section: "[tile]",
      }),
    ]);
  });

  it("keeps duplicate keys in different sections distinct", () => {
    const target = parseLangFile(
      [
        "[item]",
        "// item note",
        "title=Gegenstandstitel",
        "[npc]",
        "// npc note — shifts line indexes vs reference",
        "title=NSC-Titel",
        "",
      ].join("\n"),
    );
    const reference = parseReferenceLang(
      ["[item]", "title=Item Title", "// only in reference", "[npc]", "title=Npc Title", ""].join(
        "\n",
      ),
    );

    expect(reference.bySectionKey.get(referenceIdentity("[item]", "title"))).toEqual([
      "Item Title",
    ]);
    expect(reference.bySectionKey.get(referenceIdentity("[npc]", "title"))).toEqual(["Npc Title"]);
    expect(applyReferenceMap(target.items, reference)).toBe(2);

    const entries = target.items.filter((item): item is TranslationEntry => item.type === "entry");
    expect(entries.find((entry) => entry.section === "[item]")?.ref).toBe("Item Title");
    expect(entries.find((entry) => entry.section === "[npc]")?.ref).toBe("Npc Title");
  });

  it("matches duplicate keys inside one section by occurrence order", () => {
    const target = parseLangFile("[misc]\na=eins\na=zwei\n");
    const reference = parseReferenceLang("[misc]\na=one\na=two\n");
    expect(applyReferenceMap(target.items, reference)).toBe(2);
    const entries = target.items.filter((item): item is TranslationEntry => item.type === "entry");
    expect(entries.map((entry) => entry.ref)).toEqual(["one", "two"]);
  });

  it("creates missing translation workspace from reference", () => {
    const result = createTranslationFromReference("a=A\n//c\n[b]\nx=Y\n", "en.lang");
    expect(result.entryCount).toBe(2);
    expect(result.text).toContain("MISSING_TRANSLATION:a=A");
    expect(result.text).toContain("MISSING_TRANSLATION:x=Y");
    expect(result.referenceFilename).toBe("en.lang");
  });
});
