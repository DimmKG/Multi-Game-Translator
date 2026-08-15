// SPDX-License-Identifier: LGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { buildIniLines, parseIniLines } from "./ini";

describe("parseIniLines / buildIniLines", () => {
  it("parses blank/comment/section/pair lines, each with its own eol", () => {
    const text = ["[Section]", "// a comment", "", "key=value"].join("\n");
    const raw = parseIniLines(text);
    expect(raw.eol).toBe("\n");
    expect(raw.lines).toEqual([
      { type: "section", raw: "[Section]", name: "Section", eol: "\n" },
      { type: "comment", raw: "// a comment", eol: "\n" },
      { type: "blank", raw: "", eol: "\n" },
      { type: "pair", raw: "key=value", key: "key", value: "value", eol: "" },
    ]);
  });

  it("round-trips arbitrary text byte-for-byte", () => {
    const text = "[Section]\r\n// comment\r\nkey=value with = inside\r\n\r\n";
    const raw = parseIniLines(text);
    expect(buildIniLines(raw)).toBe(text);
  });

  it("round-trips a file with mixed \\r\\n and \\n line endings", () => {
    const text = "line1=a\r\nline2=b\nline3=c";
    const raw = parseIniLines(text);
    expect(buildIniLines(raw)).toBe(text);
  });

  it("round-trips a file with no trailing newline", () => {
    const text = "key=value";
    expect(buildIniLines(parseIniLines(text))).toBe(text);
  });

  it("supports configurable comment prefixes (Factorio-style #/;)", () => {
    const text = "# a comment\n; another\nkey=value";
    const raw = parseIniLines(text, { commentPrefixes: ["#", ";"] });
    expect(raw.lines[0]).toEqual({ type: "comment", raw: "# a comment", eol: "\n" });
    expect(raw.lines[1]).toEqual({ type: "comment", raw: "; another", eol: "\n" });
    expect(buildIniLines(raw)).toBe(text);
  });

  it("falls back to a comment for a line with no prefix and no '='", () => {
    const raw = parseIniLines("stray free text with no equals sign");
    expect(raw.lines[0]?.type).toBe("comment");
  });

  it("supports overriding every line's eol on build, normalizing mixed input", () => {
    // An explicit override applies to every line, including the last — even
    // one that originally had no trailing newline. That's the point of an
    // explicit override: normalize, not preserve.
    const text = "line1=a\r\nline2=b\nline3=c";
    const raw = parseIniLines(text);
    expect(buildIniLines(raw, { eol: "\n" })).toBe("line1=a\nline2=b\nline3=c\n");
  });
});

describe("comment preservation", () => {
  // Deserializing must never drop or rewrite source comments — this is a
  // load-bearing invariant of the "comment" StructuralNode, not an incidental
  // side effect of a general round-trip test.

  it("keeps a comment's exact text, including its original prefix, through parse + build", () => {
    const text = "// keep this exact wording, please!";
    const raw = parseIniLines(text);
    expect(raw.lines).toEqual([{ type: "comment", raw: text, eol: "" }]);
    expect(buildIniLines(raw)).toBe(text);
  });

  it("preserves every comment, in order, when interspersed between entries", () => {
    const text = [
      "// header comment",
      "[Section]",
      "// note before first key",
      "key1=value1",
      "// note before second key",
      "key2=value2",
      "// trailing comment",
    ].join("\n");
    const raw = parseIniLines(text);
    const comments = raw.lines.filter((line) => line.type === "comment").map((line) => line.raw);
    expect(comments).toEqual([
      "// header comment",
      "// note before first key",
      "// note before second key",
      "// trailing comment",
    ]);
    expect(buildIniLines(raw)).toBe(text);
  });

  it("preserves a comment containing an '=' sign without misreading it as a pair", () => {
    const text = "// see docs at https://example.com/?a=b&c=d";
    const raw = parseIniLines(text);
    expect(raw.lines[0]).toEqual({ type: "comment", raw: text, eol: "" });
    expect(buildIniLines(raw)).toBe(text);
  });

  it("preserves each comment's own prefix style when prefixes are mixed (Factorio-style #/;)", () => {
    const text = "// necesse-style\n# factorio-style\n; also factorio-style";
    const raw = parseIniLines(text, { commentPrefixes: ["//", "#", ";"] });
    expect(raw.lines.map((line) => line.raw)).toEqual([
      "// necesse-style",
      "# factorio-style",
      "; also factorio-style",
    ]);
    expect(buildIniLines(raw)).toBe(text);
  });
});
