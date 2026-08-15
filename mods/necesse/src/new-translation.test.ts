// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  iniFileLoader,
  type DocumentNode,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";
import { describe, expect, it } from "vitest";
import { necesseGameLoader } from "./game-loader";

function createDoc(name: string, text: string): TranslationDocument {
  const raw = iniFileLoader.parse({ files: [{ name, text }] });
  if (!necesseGameLoader.createFromReference) {
    throw new Error("necesseGameLoader does not implement createFromReference");
  }
  return necesseGameLoader.createFromReference(raw);
}

function entries(doc: TranslationDocument): TranslationEntry[] {
  return doc.nodes
    .filter((node): node is Extract<DocumentNode, { type: "entry" }> => node.type === "entry")
    .map((node) => node.entry);
}

function exportedText(doc: TranslationDocument): string {
  const raw = necesseGameLoader.fromDocument(doc);
  return iniFileLoader.serialize(raw).files[0]?.text ?? "";
}

describe("necesseGameLoader.createFromReference", () => {
  it("marks every entry missing by default, using the reference text as the starting point", () => {
    const source = [
      "// header",
      "[general]",
      "hello=Hello <name>",
      "MISSING_TRANSLATION:old=Old\r\nline",
      "",
      "// footer",
    ].join("\r\n");

    const doc = createDoc("en.lang", source);
    const items = entries(doc);
    expect(items).toHaveLength(2);
    for (const entry of items) {
      expect(entry.status).toBe("missing");
      expect(entry.target).toBe(entry.source);
    }
    expect(items.map((entry) => entry.key)).toEqual(["hello", "old"]);

    expect(exportedText(doc)).toBe(
      [
        "// header",
        "[general]",
        "MISSING_TRANSLATION:hello=Hello <name>",
        "MISSING_TRANSLATION:old=Old\r\nline",
        "",
        "// footer",
      ].join("\r\n"),
    );
  });

  it("preserves a SAME_TRANSLATION tag already on the reference, instead of discarding it", () => {
    const source = [
      "[general]",
      "hello=Hello <name>",
      "SAME_TRANSLATION:unchanged=Keep [item/input=stone]",
    ].join("\n");

    const doc = createDoc("en.lang", source);
    const items = entries(doc);
    const hello = items.find((entry) => entry.key === "hello");
    const unchanged = items.find((entry) => entry.key === "unchanged");
    expect(hello?.status).toBe("missing");
    // Verified same, not just "translated": the draft's own SAME_TRANSLATION
    // tag matches trivially against the reference it was copied from.
    expect(unchanged?.status).toBe("same");

    expect(exportedText(doc)).toBe(
      [
        "[general]",
        "MISSING_TRANSLATION:hello=Hello <name>",
        "SAME_TRANSLATION:unchanged=Keep [item/input=stone]",
      ].join("\n"),
    );
  });

  it("preserves structure without inventing entries for a reference with none", () => {
    const source = "// comments only\n[section]";
    const doc = createDoc("empty.lang", source);
    expect(entries(doc)).toHaveLength(0);
    expect(exportedText(doc)).toBe(source);
  });

  it("keeps duplicate keys within one section distinct, matched by occurrence", () => {
    const doc = createDoc("en.lang", "[misc]\na=one\na=two\n");
    const items = entries(doc);
    expect(items.map((entry) => entry.source)).toEqual(["one", "two"]);
    expect(items.map((entry) => entry.target)).toEqual(["one", "two"]);
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });

  it("throws when given an empty raw array", () => {
    expect(() => necesseGameLoader.createFromReference?.([])).toThrow(/requires a reference file/);
  });
});
