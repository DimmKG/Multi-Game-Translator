// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  iniFileLoader,
  type DocumentNode,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";
import { describe, expect, it } from "vitest";
import { genericIniGameLoader } from "./game-loader";

function toDoc(
  files: Array<{ name: string; text: string }>,
  roles: Array<{ role: string }>,
  targetLocale = "ru",
): TranslationDocument {
  const raw = iniFileLoader.parse({ files });
  return genericIniGameLoader.toDocument(raw, roles, targetLocale);
}

function entries(doc: TranslationDocument): TranslationEntry[] {
  return doc.nodes
    .filter((node): node is Extract<DocumentNode, { type: "entry" }> => node.type === "entry")
    .map((node) => node.entry);
}

describe("genericIniGameLoader.toDocument", () => {
  it("preserves sections, blank/comment lines and CRLF", () => {
    const doc = toDoc(
      [{ name: "t.ini", text: "[misc]\r\n// note\r\n\r\nhello=Hello\r\n" }],
      [{ role: "translation" }],
    );
    expect(doc.formatMeta).toMatchObject({ eol: "\r\n" });
    expect(doc.nodes[0]).toMatchObject({ type: "section", name: "misc" });
    expect(doc.nodes[1]).toMatchObject({ type: "comment" });
    expect(doc.nodes[2]).toMatchObject({ type: "blank" });

    const [hello] = entries(doc);
    expect(hello).toMatchObject({ key: "hello", target: "Hello", status: "translated" });
  });

  it("falls back to its own value as source if called without a reference role (defensive, not the supported workflow — requiredFiles marks reference required)", () => {
    const doc = toDoc([{ name: "t.ini", text: "hello=Hallo\n" }], [{ role: "translation" }]);
    const [hello] = entries(doc);
    expect(hello).toMatchObject({ source: "Hallo", target: "Hallo", status: "translated" });
  });

  it("matches by key against a reference file within the same section", () => {
    const doc = toDoc(
      [
        { name: "en.ini", text: "[misc]\nhello=Hello\n" },
        { name: "t.ini", text: "[misc]\nhello=Hallo\n" },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );
    const [hello] = entries(doc);
    expect(hello).toMatchObject({ source: "Hello", target: "Hallo" });
  });

  it("last reference occurrence wins for a duplicate key in one section (documented simplification)", () => {
    const doc = toDoc(
      [
        { name: "en.ini", text: "hello=First\nhello=Second\n" },
        { name: "t.ini", text: "hello=A\nhello=B\n" },
      ],
      [{ role: "reference" }, { role: "translation" }],
    );
    const [first, second] = entries(doc);
    // Not per-occurrence matching (unlike Necesse's reference queue) — every
    // occurrence of a duplicate key resolves against the same, last-wins value.
    expect(first).toMatchObject({ source: "Second", target: "A" });
    expect(second).toMatchObject({ source: "Second", target: "B" });
  });

  it("statusStrategy: empty target reads as missing, anything else as translated", () => {
    const doc = toDoc([{ name: "t.ini", text: "a=\nb=x\n" }], [{ role: "translation" }]);
    const [a, b] = entries(doc);
    expect(a.status).toBe("missing");
    expect(b.status).toBe("translated");
  });
});

describe("genericIniGameLoader.fromDocument", () => {
  it("round-trips a document, byte-for-byte, when untouched", () => {
    const text = "[misc]\n// note\nhello=Hello\nbye=Bye\n";
    const doc = toDoc([{ name: "t.ini", text }], [{ role: "translation" }]);
    const raw = genericIniGameLoader.fromDocument(doc);
    const output = iniFileLoader.serialize(raw);
    expect(output.files[0]?.text).toBe(text);
  });

  it("preserves a file without a trailing newline", () => {
    const text = "key=value";
    const doc = toDoc([{ name: "t.ini", text }], [{ role: "translation" }]);
    const raw = genericIniGameLoader.fromDocument(doc);
    expect(iniFileLoader.serialize(raw).files[0]?.text).toBe(text);
  });

  it("restores the original translation filename", () => {
    const doc = toDoc([{ name: "custom.cfg", text: "key=value\n" }], [{ role: "translation" }]);
    const raw = genericIniGameLoader.fromDocument(doc);
    expect(raw[0]?.name).toBe("custom.cfg");
  });

  it("falls back to translation.ini when gameMeta carries no filename", () => {
    const doc = toDoc([{ name: "custom.cfg", text: "key=value\n" }], [{ role: "translation" }]);
    const stripped: TranslationDocument = { ...doc, gameMeta: {} };
    const raw = genericIniGameLoader.fromDocument(stripped);
    expect(raw[0]?.name).toBe("translation.ini");
  });

  it("throws instead of silently corrupting output when formatMeta is foreign/malformed", () => {
    const doc = toDoc([{ name: "t.ini", text: "key=value\n" }], [{ role: "translation" }]);
    const foreign: TranslationDocument = { ...doc, formatMeta: {} };
    expect(() => genericIniGameLoader.fromDocument(foreign)).toThrow(/formatMeta/);
  });
});

describe("genericIniGameLoader.detectGame", () => {
  it("matches iniFileLoader.detect directly, with no per-game scoring bonus", () => {
    const input = { files: [{ name: "t.ini", text: "[a]\nkey=value\n" }] };
    expect(genericIniGameLoader.detectGame(input)).toBe(Number(iniFileLoader.detect(input)));
  });

  it("returns 0 for an empty file list", () => {
    expect(genericIniGameLoader.detectGame({ files: [] })).toBe(0);
  });
});

describe("genericIniGameLoader — minimal-by-design surface", () => {
  it("has no createFromReference (the SDK's generic helper would read a fresh draft as 'translated', not 'missing')", () => {
    expect(genericIniGameLoader.createFromReference).toBeUndefined();
  });

  it("placeholders.tokenize always returns an empty array", () => {
    expect(genericIniGameLoader.placeholders.tokenize("<x> [y] anything")).toEqual([]);
  });

  it("has no pluralSelector or identity strategy of its own", () => {
    expect(genericIniGameLoader.pluralSelector).toBeUndefined();
    expect(genericIniGameLoader.identity).toBeUndefined();
  });
});
