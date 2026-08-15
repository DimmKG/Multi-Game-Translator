// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { iniFileLoader } from "./ini-file-loader";

const FIXTURES = [
  "../../../../test/fixtures/synthetic-en.lang",
  "../../../../test/fixtures/synthetic-target.lang",
  "../../../../test/fixtures/synthetic-large.lang",
];

function readFixture(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("iniFileLoader", () => {
  it("has the documented id/displayName/extensions", () => {
    expect(iniFileLoader.id).toBe("ini");
    expect(iniFileLoader.extensions).toContain(".lang");
    expect(iniFileLoader.extensions).toContain(".cfg");
  });

  describe("round-trips every real .lang fixture byte-for-byte", () => {
    it.each(FIXTURES)("%s", (relativePath) => {
      const text = readFixture(relativePath);
      const raw = iniFileLoader.parse({ files: [{ name: "fixture.lang", text }] });
      const output = iniFileLoader.serialize(raw);
      expect(output.files).toHaveLength(1);
      expect(output.files[0]?.text).toBe(text);
    });
  });

  it("parses multiple input files into one entry per file, preserving order and names", () => {
    const raw = iniFileLoader.parse({
      files: [
        { name: "translation.lang", text: "key=value" },
        { name: "meta.lang", text: "[lang]\nlocalname=Test" },
      ],
    });
    expect(raw).toHaveLength(2);
    expect(raw[0]?.name).toBe("translation.lang");
    expect(raw[1]?.name).toBe("meta.lang");
    expect(raw[1]?.ini.lines.some((line) => line.type === "section")).toBe(true);
  });

  it("serialize reconstructs a FileLoaderInput with matching file names", () => {
    const raw = iniFileLoader.parse({
      files: [
        { name: "a.lang", text: "a=1" },
        { name: "b.lang", text: "b=2" },
      ],
    });
    const output = iniFileLoader.serialize(raw);
    expect(output.files.map((file) => file.name)).toEqual(["a.lang", "b.lang"]);
    expect(output.files.map((file) => file.text)).toEqual(["a=1", "b=2"]);
  });

  it("decodes a file provided only as bytes", () => {
    const bytes = new TextEncoder().encode("key=value");
    const raw = iniFileLoader.parse({ files: [{ name: "f.lang", bytes }] });
    expect(raw[0]?.ini.lines[0]).toEqual({
      type: "pair",
      raw: "key=value",
      key: "key",
      value: "value",
      eol: "",
    });
  });

  it("throws a FileLoaderParseError when a file has neither text nor bytes", () => {
    expect(() => iniFileLoader.parse({ files: [{ name: "f.lang" }] })).toThrow(
      /neither text nor bytes/,
    );
  });

  describe("detect", () => {
    it("scores a well-formed ini/lang file highly", () => {
      const score = iniFileLoader.detect({
        files: [{ name: "f.lang", text: "[section]\n// comment\nkey=value\n" }],
      });
      expect(score).toBe(1);
    });

    it("scores plain prose low", () => {
      const score = iniFileLoader.detect({
        files: [{ name: "f.txt", text: "This is just a paragraph of ordinary prose text." }],
      });
      expect(score).toBeLessThan(0.5);
    });

    it("returns 0 for an empty file list", () => {
      expect(iniFileLoader.detect({ files: [] })).toBe(0);
    });

    it("only samples the first ~200 lines, ignoring content further into a large file", () => {
      const wellFormedPrefix = Array.from({ length: 200 }, (_, i) => `key${i}=value${i}`).join(
        "\n",
      );
      const proseTail = Array.from(
        { length: 5000 },
        () => "this trailing line is ordinary prose with no key-value structure at all",
      ).join("\n");
      const score = iniFileLoader.detect({
        files: [{ name: "f.lang", text: `${wellFormedPrefix}\n${proseTail}` }],
      });
      // If the tail were scanned, this many prose lines would drag the score
      // well below 1 — a score of 1 proves detection stayed within the prefix.
      expect(score).toBe(1);
    });
  });
});
