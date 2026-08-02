import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildLangFile } from "@/core/lang/export";
import { parseLangFile } from "@/core/lang/parse";
import { diffRows, summarizeRows } from "./token-aware-diff";

// Committed synthetic fixture — not a copyrighted game localization file.
const raw = readFileSync(
  new URL("../../../test/fixtures/synthetic-large.lang", import.meta.url),
  "utf8",
);
const lines = raw.split(/\r\n|\n/);

/**
 * A full LCS matrix is unaffordable past ~1200 lines, and a real .lang file is
 * several thousand. Alignment used to give up entirely at that point and report
 * every line as changed, which made "only differences" hide nothing.
 */
describe("alignment on real-sized files", () => {
  it("reports no differences between a file and its own export", () => {
    const parsed = parseLangFile(raw);
    const rebuilt = buildLangFile(parsed.items, parsed.eol).split(/\r\n|\n/);
    const rows = diffRows(lines, rebuilt);
    const summary = summarizeRows(rows, lines, rebuilt);

    expect(lines.length).toBeGreaterThan(5000);
    expect(rows.every((row) => row.kind === "equal")).toBe(true);
    expect(summary).toMatchObject({ added: 0, deleted: 0, changed: 0 });
  });

  it("isolates individual edits instead of flagging the whole file", () => {
    const edited = [...lines];
    edited[200] = `${edited[200]} edited`;
    edited[1500] = `${edited[1500]} edited`;
    edited.splice(3000, 1);
    edited.splice(5000, 0, "addedkey=Added");

    const rows = diffRows(lines, edited);
    const summary = summarizeRows(rows, lines, edited);

    expect(summary.changed).toBe(2);
    expect(summary.added).toBe(1);
    expect(summary.deleted).toBe(1);
    expect(rows.filter((row) => row.kind === "equal").length).toBeGreaterThan(lines.length - 10);
  });

  it("still aligns when one side is truncated", () => {
    const half = lines.slice(0, Math.floor(lines.length / 2));
    const rows = diffRows(lines, half);
    const equal = rows.filter((row) => row.kind === "equal").length;
    expect(equal).toBeGreaterThan(half.length - 10);
  });
});
