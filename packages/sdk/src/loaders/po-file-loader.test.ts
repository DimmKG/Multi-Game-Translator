// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { iniFileLoader } from "./ini-file-loader";
import { poFileLoader } from "./po-file-loader";

const REAL_PO_TEXT = [
  "# translator comment",
  "#: src/main.c:10",
  'msgid ""',
  'msgstr ""',
  '"Content-Type: text/plain; charset=UTF-8\\n"',
  "",
  'msgid "Hello"',
  'msgstr "Bonjour"',
  "",
  'msgid "one file"',
  'msgid_plural "%d files"',
  'msgstr[0] "un fichier"',
  'msgstr[1] "%d fichiers"',
  "",
].join("\n");

const REAL_INI_TEXT = ["[misc]", "greeting=Hello", "farewell=Bye", ""].join("\n");

describe("poFileLoader", () => {
  it("has the documented id/displayName/extensions", () => {
    expect(poFileLoader.id).toBe("po");
    expect(poFileLoader.extensions).toContain(".po");
    expect(poFileLoader.extensions).toContain(".pot");
  });

  it("parses and serializes through the FileLoaderInput/files[] convention", () => {
    const raw = poFileLoader.parse({ files: [{ name: "fr.po", text: REAL_PO_TEXT }] });
    expect(raw).toHaveLength(1);
    expect(raw[0].name).toBe("fr.po");
    expect(raw[0].po.messages).toHaveLength(2);
    const output = poFileLoader.serialize(raw);
    expect(output.files).toHaveLength(1);
    expect(output.files[0]?.name).toBe("fr.po");
    // Semantic round-trip (see po.test.ts for the detailed contract).
    const reparsed = poFileLoader.parse({
      files: [{ name: "fr.po", text: output.files[0]!.text }],
    });
    expect(reparsed[0].po.messages).toEqual(raw[0].po.messages);
  });

  describe("detect() distinguishes real .po content from ini-family content", () => {
    it("scores real PO text high", () => {
      expect(
        poFileLoader.detect({ files: [{ name: "fr.po", text: REAL_PO_TEXT }] }),
      ).toBeGreaterThan(0.8);
    });

    it("scores ini-shaped text low", () => {
      expect(
        poFileLoader.detect({ files: [{ name: "en.lang", text: REAL_INI_TEXT }] }),
      ).toBeLessThan(0.3);
    });

    it("iniFileLoader, symmetrically, does not confidently claim real PO text", () => {
      expect(iniFileLoader.detect({ files: [{ name: "fr.po", text: REAL_PO_TEXT }] })).toBeLessThan(
        0.5,
      );
    });

    it("returns 0 for no files", () => {
      expect(poFileLoader.detect({ files: [] })).toBe(0);
    });
  });
});
