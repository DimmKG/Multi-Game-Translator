// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  iniFileLoader,
  type DocumentNode,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";
import { describe, expect, it } from "vitest";
import { factorioGameLoader } from "./game-loader";

function toDoc(
  files: Array<{ name: string; text: string }>,
  roles: Array<{ role: string }>,
  targetLocale = "ru",
): TranslationDocument {
  const raw = iniFileLoader.parse({ files });
  return factorioGameLoader.toDocument(raw, roles, targetLocale);
}

function entries(doc: TranslationDocument): TranslationEntry[] {
  return doc.nodes
    .filter((node): node is Extract<DocumentNode, { type: "entry" }> => node.type === "entry")
    .map((node) => node.entry);
}

describe("factorioGameLoader.toDocument", () => {
  it("preserves sections, comments and CRLF", () => {
    const doc = toDoc(
      [{ name: "t.cfg", text: "[item-name]\r\n; a comment\r\niron-plate=Iron plate\r\n" }],
      [{ role: "translation" }],
    );
    expect(doc.formatMeta).toMatchObject({ eol: "\r\n" });
    expect(doc.nodes[0]).toMatchObject({ type: "section", name: "item-name" });
    expect(doc.nodes[1]).toMatchObject({ type: "comment" });
    const [ironPlate] = entries(doc);
    expect(ironPlate).toMatchObject({
      key: "iron-plate",
      target: "Iron plate",
      status: "translated",
    });
  });

  it("treats an empty target as missing, same as generic-ini", () => {
    const doc = toDoc([{ name: "t.cfg", text: "[a]\nk=\n" }], [{ role: "translation" }]);
    expect(entries(doc)[0]?.status).toBe("missing");
  });

  it("matches source text against a reference file by section+key", () => {
    const doc = toDoc(
      [
        { name: "en.cfg", text: "[item-name]\niron-plate=Iron plate\n" },
        { name: "t.cfg", text: "[item-name]\niron-plate=Plaque de fer\n" },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );
    const [entry] = entries(doc);
    expect(entry).toMatchObject({
      source: "Iron plate",
      target: "Plaque de fer",
      namespace: "item-name",
    });
  });
});

describe("factorioGameLoader.fromDocument", () => {
  it("round-trips a document with no edits, byte-for-byte", () => {
    const text = "[item-name]\niron-plate=Iron plate\n";
    const doc = toDoc([{ name: "t.cfg", text }], [{ role: "translation" }]);
    const raw = factorioGameLoader.fromDocument(doc);
    expect(iniFileLoader.serialize(raw).files[0]?.text).toBe(text);
  });

  it("throws instead of silently corrupting output when formatMeta is foreign", () => {
    const doc = toDoc([{ name: "t.cfg", text: "k=v\n" }], [{ role: "translation" }]);
    expect(() => factorioGameLoader.fromDocument({ ...doc, formatMeta: {} })).toThrow(/formatMeta/);
  });
});

describe("factorioGameLoader.createFromReference", () => {
  it("produces all-missing entries with the correct source, not a target===source misclassification", () => {
    const referenceRaw = iniFileLoader.parse({
      files: [
        { name: "en.cfg", text: "[item-name]\niron-plate=Iron plate\ncopper-plate=Copper plate\n" },
      ],
    });
    const doc = factorioGameLoader.createFromReference!(referenceRaw, "fr");
    const created = entries(doc);
    expect(created).toHaveLength(2);
    for (const entry of created) {
      expect(entry.status).toBe("missing");
      expect(entry.target).toBe("");
    }
    expect(created.map((entry) => entry.source)).toEqual(["Iron plate", "Copper plate"]);
  });
});

describe("factorioGameLoader.detectGame", () => {
  it("scores content with positional and plural placeholders highly", () => {
    const score = factorioGameLoader.detectGame({
      files: [
        {
          name: "en.cfg",
          text: "[item-name]\nfoo=You need __1__ __plural_for_parameter_1_{1=item|rest=items}__\n",
        },
      ],
    });
    expect(score).toBe(1);
  });

  it("scores plain ini/cfg content with no Factorio-specific markers lower", () => {
    const score = factorioGameLoader.detectGame({
      files: [{ name: "en.cfg", text: "[a]\nk=v\n" }],
    });
    expect(score).toBeLessThan(0.5);
  });

  it("returns 0 for an empty file list", () => {
    expect(factorioGameLoader.detectGame({ files: [] })).toBe(0);
  });
});
