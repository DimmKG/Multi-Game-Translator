// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  poFileLoader,
  type DocumentNode,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";
import { describe, expect, it } from "vitest";
import { gettextGameLoader } from "./game-loader";

function toDoc(
  text: string,
  targetLocale: string,
  roles = [{ role: "translation" }],
): TranslationDocument {
  const raw = poFileLoader.parse({ files: [{ name: "t.po", text }] });
  return gettextGameLoader.toDocument(raw, roles, targetLocale);
}

function entries(doc: TranslationDocument): TranslationEntry[] {
  return doc.nodes
    .filter((node): node is Extract<DocumentNode, { type: "entry" }> => node.type === "entry")
    .map((node) => node.entry);
}

const RUSSIAN_HEADER = [
  'msgid ""',
  'msgstr ""',
  '"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);\\n"',
  "",
].join("\n");

describe("gettextGameLoader.toDocument", () => {
  it("maps msgctxt to namespace and surfaces comments/flags", () => {
    const doc = toDoc(
      ["#, fuzzy", "#. a note", 'msgctxt "menu"', 'msgid "Open"', 'msgstr "Ouvrir"', ""].join("\n"),
      "fr",
    );
    const [entry] = entries(doc);
    expect(entry.namespace).toBe("menu");
    expect(entry.key).toBe("Open");
    expect(entry.source).toBe("Open");
    expect(entry.target).toBe("Ouvrir");
    expect(entry.status).toBe("draft"); // fuzzy
  });

  it("empty msgstr is missing regardless of fuzzy", () => {
    const doc = toDoc(['msgid "Open"', 'msgstr ""', ""].join("\n"), "fr");
    expect(entries(doc)[0]?.status).toBe("missing");
  });

  it("non-fuzzy, non-empty msgstr is translated", () => {
    const doc = toDoc(['msgid "Open"', 'msgstr "Ouvrir"', ""].join("\n"), "fr");
    expect(entries(doc)[0]?.status).toBe("translated");
  });

  it("bridges a plural entry against Russian's real 3-way Plural-Forms", () => {
    const text = [
      RUSSIAN_HEADER,
      'msgid "one file"',
      'msgid_plural "%d files"',
      'msgstr[0] "один файл"',
      'msgstr[1] "%d файла"',
      'msgstr[2] "%d файлов"',
      "",
    ].join("\n");
    const doc = toDoc(text, "ru");
    const [entry] = entries(doc);
    expect(entry.sourcePlurals).toEqual({ one: "one file", other: "%d files" });
    expect(entry.targetPlurals).toEqual({ one: "один файл", few: "%d файла", many: "%d файлов" });
    // No "other" category for Russian — the flat fallback picks some
    // populated category (not asserting which one specifically).
    expect(Object.values(entry.targetPlurals ?? {})).toContain(entry.target);
  });

  it("bridges a plural entry against English/French/Japanese Plural-Forms", () => {
    const enDoc = toDoc(
      [
        'msgid "one file"',
        'msgid_plural "%d files"',
        'msgstr[0] "one file"',
        'msgstr[1] "%d files"',
        "",
      ].join("\n"),
      "en",
    );
    expect(entries(enDoc)[0]?.targetPlurals).toEqual({ one: "one file", other: "%d files" });

    const frDoc = toDoc(
      [
        'msgid ""',
        'msgstr ""',
        '"Plural-Forms: nplurals=2; plural=(n > 1);\\n"',
        "",
        'msgid "one file"',
        'msgid_plural "%d files"',
        'msgstr[0] "un fichier"',
        'msgstr[1] "%d fichiers"',
        "",
      ].join("\n"),
      "fr",
    );
    expect(entries(frDoc)[0]?.targetPlurals).toEqual({ one: "un fichier", other: "%d fichiers" });

    const jaDoc = toDoc(
      [
        'msgid ""',
        'msgstr ""',
        '"Plural-Forms: nplurals=1; plural=0;\\n"',
        "",
        'msgid "one file"',
        'msgid_plural "%d files"',
        'msgstr[0] "%d個のファイル"',
        "",
      ].join("\n"),
      "ja",
    );
    expect(entries(jaDoc)[0]?.targetPlurals).toEqual({ other: "%d個のファイル" });
  });

  it("collapses an obsolete (#~) block into a non-editable comment node", () => {
    const doc = toDoc(['#~ msgid "Old"', '#~ msgstr "Ancien"', ""].join("\n"), "fr");
    expect(entries(doc)).toHaveLength(0);
    const commentNode = doc.nodes.find((node) => node.type === "comment");
    expect(commentNode).toBeDefined();
    expect((commentNode as { raw: string }).raw).toContain("#~");
  });
});

describe("gettextGameLoader.fromDocument", () => {
  it("round-trips a non-plural entry semantically", () => {
    const text = ['msgid "Open"', 'msgstr "Ouvrir"', ""].join("\n");
    const doc = toDoc(text, "fr");
    const raw = gettextGameLoader.fromDocument(doc);
    const output = poFileLoader.serialize(raw);
    const reparsed = poFileLoader.parse({ files: [{ name: "t.po", text: output.files[0]!.text }] });
    expect(reparsed[0].po.messages[0].msgid).toBe("Open");
    expect(reparsed[0].po.messages[0].msgstr).toEqual(["Ouvrir"]);
  });

  it("reconstructs msgstr[] in the right gettext-index order for a Russian target", () => {
    const text = [
      RUSSIAN_HEADER,
      'msgid "one file"',
      'msgid_plural "%d files"',
      'msgstr[0] "один файл"',
      'msgstr[1] "%d файла"',
      'msgstr[2] "%d файлов"',
      "",
    ].join("\n");
    const doc = toDoc(text, "ru");
    const raw = gettextGameLoader.fromDocument(doc);
    expect(raw[0].po.messages[0].msgstr).toEqual(["один файл", "%d файла", "%d файлов"]);
  });

  it("round-trips an obsolete block verbatim", () => {
    const doc = toDoc(['#~ msgid "Old"', '#~ msgstr "Ancien"', ""].join("\n"), "fr");
    const raw = gettextGameLoader.fromDocument(doc);
    expect(raw[0].po.messages).toHaveLength(1);
    expect(raw[0].po.messages[0].obsolete).toBe(true);
    expect(raw[0].po.messages[0].msgid).toBe("Old");
    expect(raw[0].po.messages[0].msgstr).toEqual(["Ancien"]);
  });
});

describe("gettextGameLoader.applyEntryPatch", () => {
  it("edits target and clears fuzzy on a non-plural entry", () => {
    const doc = toDoc(["#, fuzzy", 'msgid "Open"', 'msgstr "Ouvrire"', ""].join("\n"), "fr");
    const [entry] = entries(doc);
    const patched = gettextGameLoader.applyEntryPatch(entry, { target: "Ouvrir" });
    expect(patched.target).toBe("Ouvrir");
    expect(patched.status).toBe("translated");
    const raw = gettextGameLoader.fromDocument({
      ...doc,
      nodes: [{ type: "entry", entry: patched }],
    });
    expect(raw[0].po.messages[0].comments.some((c) => c.kind === "flag")).toBe(false);
  });

  it("syncs targetPlurals.other and status on a plural entry", () => {
    const doc = toDoc(
      [
        'msgid "one file"',
        'msgid_plural "%d files"',
        'msgstr[0] "one file"',
        'msgstr[1] "%d files"',
        "",
      ].join("\n"),
      "en",
    );
    const [entry] = entries(doc);
    const patched = gettextGameLoader.applyEntryPatch(entry, { target: "%d files (edited)" });
    expect(patched.target).toBe("%d files (edited)");
    expect(patched.targetPlurals?.other).toBe("%d files (edited)");
    expect(patched.status).toBe("translated");
  });

  it("patches one CLDR category individually via targetPluralCategory, leaving others untouched", () => {
    const doc = toDoc(
      [
        RUSSIAN_HEADER,
        'msgid "one file"',
        'msgid_plural "%d files"',
        'msgstr[0] "один файл"',
        'msgstr[1] "%d файла"',
        'msgstr[2] "%d файлов"',
        "",
      ].join("\n"),
      "ru",
    );
    const [entry] = entries(doc);
    const patched = gettextGameLoader.applyEntryPatch(entry, {
      targetPluralCategory: { category: "few", value: "%d файла (edited)" },
    });
    expect(patched.targetPlurals).toEqual({
      one: "один файл",
      few: "%d файла (edited)",
      many: "%d файлов",
    });
    expect(patched.status).toBe("translated");
  });
});

describe("gettextGameLoader.createFromReference", () => {
  it("produces all-missing entries, fuzzy stripped, plurals still populated", () => {
    const referenceRaw = poFileLoader.parse({
      files: [
        {
          name: "template.pot",
          text: [
            "#, fuzzy",
            'msgid "one file"',
            'msgid_plural "%d files"',
            'msgstr[0] "one file"',
            'msgstr[1] "%d files"',
            "",
          ].join("\n"),
        },
      ],
    });
    const doc = gettextGameLoader.createFromReference!(referenceRaw, "en");
    const [entry] = entries(doc);
    expect(entry.status).toBe("missing");
    expect(entry.target).toBe("");
    expect(entry.sourcePlurals).toEqual({ one: "one file", other: "%d files" });
    expect(entry.targetPlurals).toEqual({ one: "", other: "" });
  });
});

describe("gettextGameLoader.detectGame", () => {
  it("scores real PO content highly", () => {
    const score = gettextGameLoader.detectGame({
      files: [{ name: "fr.po", text: 'msgid "Hello"\nmsgstr "Bonjour"\n' }],
    });
    expect(score).toBeGreaterThan(0.8);
  });

  it("scores ini/lang content low", () => {
    const score = gettextGameLoader.detectGame({
      files: [{ name: "en.lang", text: "[misc]\nkey=value\n" }],
    });
    expect(score).toBeLessThan(0.3);
  });
});
