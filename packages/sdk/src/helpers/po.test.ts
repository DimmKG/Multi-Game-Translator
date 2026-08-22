// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { buildPoText, parsePoText, poMessageFlags } from "./po";

describe("parsePoText", () => {
  it("parses a simple singular entry with all 5 comment kinds, round-tripping byte-for-byte", () => {
    const text = [
      "# translator note",
      "#. extracted note",
      "#: src/foo.c:42",
      "#, fuzzy, c-format",
      '#| msgid "old text"',
      'msgid "Hello"',
      'msgstr "Bonjour"',
      "",
    ].join("\n");
    const raw = parsePoText(text);
    expect(raw.messages).toHaveLength(1);
    const [message] = raw.messages;
    expect(message.comments).toEqual([
      { kind: "translator", text: " translator note" },
      { kind: "extracted", text: " extracted note" },
      { kind: "reference", text: " src/foo.c:42" },
      { kind: "flag", text: " fuzzy, c-format" },
      { kind: "previous", text: ' msgid "old text"' },
    ]);
    expect(message.msgid).toBe("Hello");
    expect(message.msgstr).toEqual(["Bonjour"]);
    expect(message.obsolete).toBe(false);
    expect(poMessageFlags(message)).toEqual(["fuzzy", "c-format"]);
    // Byte-for-byte: every comment line reproduces verbatim.
    expect(buildPoText(raw)).toBe(text);
  });

  it("concatenates multi-line msgid/msgstr continuations", () => {
    const text = [
      'msgid ""',
      '"Line one "',
      '"line two"',
      'msgstr ""',
      '"Ligne un "',
      '"ligne deux"',
      "",
    ].join("\n");
    const [message] = parsePoText(text).messages;
    expect(message.msgid).toBe("Line one line two");
    expect(message.msgstr).toEqual(["Ligne un ligne deux"]);
  });

  it("parses msgctxt", () => {
    const text = ['msgctxt "menu"', 'msgid "Open"', 'msgstr "Ouvrir"', ""].join("\n");
    const [message] = parsePoText(text).messages;
    expect(message.msgctxt).toBe("menu");
  });

  it("parses a plural message, including a gap (missing msgstr[1]) without throwing", () => {
    const text = [
      'msgid "one file"',
      'msgid_plural "%d files"',
      'msgstr[0] "un fichier"',
      'msgstr[2] "%d fichiers (many)"',
      "",
    ].join("\n");
    const [message] = parsePoText(text).messages;
    expect(message.msgidPlural).toBe("%d files");
    expect(message.msgstr).toEqual(["un fichier", "", "%d fichiers (many)"]);
  });

  it('unescapes \\n \\t \\" \\\\ \\r both directions, keeping an unrecognized escape verbatim', () => {
    const text = ['msgid "a\\nb\\tc\\"d\\\\e\\rf\\qg"', 'msgstr ""', ""].join("\n");
    const [message] = parsePoText(text).messages;
    expect(message.msgid).toBe('a\nb\tc"d\\e\rf\\qg');
    // Round-trips back to valid escaped PO text (not necessarily the exact
    // same bytes for \q, which isn't a real gettext escape to begin with).
    const rebuilt = parsePoText(buildPoText(parsePoText(text)));
    expect(rebuilt.messages[0].msgid).toBe(message.msgid);
  });

  it("parses the header's Content-Type/Plural-Forms/Language fields, preserving order", () => {
    const text = [
      'msgid ""',
      'msgstr ""',
      '"Project-Id-Version: demo\\n"',
      '"Language: ru\\n"',
      '"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : 1);\\n"',
      '"Content-Type: text/plain; charset=UTF-8\\n"',
      "",
    ].join("\n");
    const raw = parsePoText(text);
    expect(Object.keys(raw.header.fields)).toEqual([
      "Project-Id-Version",
      "Language",
      "Plural-Forms",
      "Content-Type",
    ]);
    expect(raw.header.fields["Language"]).toBe("ru");
    expect(raw.header.fields["Plural-Forms"]).toBe(
      "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : 1);",
    );
    expect(raw.messages).toHaveLength(0);
  });

  it("parses an obsolete (#~) block and reproduces an equivalent one on rebuild", () => {
    const text = ['#~ msgid "Old string"', '#~ msgstr "Ancienne chaîne"', ""].join("\n");
    const raw = parsePoText(text);
    expect(raw.messages).toHaveLength(1);
    expect(raw.messages[0].obsolete).toBe(true);
    expect(raw.messages[0].msgid).toBe("Old string");
    expect(raw.messages[0].msgstr).toEqual(["Ancienne chaîne"]);
    const reparsed = parsePoText(buildPoText(raw));
    expect(reparsed.messages[0].obsolete).toBe(true);
    expect(reparsed.messages[0].msgid).toBe("Old string");
    expect(reparsed.messages[0].msgstr).toEqual(["Ancienne chaîne"]);
  });

  it("round-trips semantically through parse -> serialize -> parse, even when raw bytes differ", () => {
    const text = ['msgid ""', '"Line one "', '"line two"', 'msgstr "one line"', ""].join("\n");
    const first = parsePoText(text);
    const rebuiltText = buildPoText(first);
    expect(rebuiltText).not.toBe(text); // multi-line collapsed to one physical line
    const second = parsePoText(rebuiltText);
    expect(second.messages).toEqual(first.messages);
  });
});
