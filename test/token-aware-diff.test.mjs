import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/scripts/compare/token-aware-diff.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const diff = context.NecesseTokenAwareDiff;

test("status prefixes are ignored for alignment but remain visible as changes", () => {
  const left = ["MISSING_TRANSLATION:greeting=Hello"];
  const right = ["greeting=Hello"];
  const rows = diff.diffRows(left, right);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "change");
  assert.equal(rows[0].prefixOnly, true);
  assert.deepEqual({ ...diff.summarizeRows(rows, left, right) }, {
    added: 0,
    deleted: 0,
    changed: 1,
    prefixOnly: 1,
    changedKeys: 0,
    changedValues: 0
  });
});

test("entry comparison reports key and value changes separately", () => {
  const detail = diff.compareEntryPair("oldkey=Old value", "newkey=New value");
  assert.equal(detail.type, "entry");
  assert.equal(detail.statusChanged, false);
  assert.equal(detail.keyChanged, true);
  assert.equal(detail.valueChanged, true);
});

test("protected placeholders remain atomic in word mode", () => {
  const result = diff.inlineSegments("Hello <name>!", "Hi <name>!", "word");
  const leftEqual = result.left.filter(segment => segment.kind === "equal").map(segment => segment.text).join("");
  const rightEqual = result.right.filter(segment => segment.kind === "equal").map(segment => segment.text).join("");
  assert.match(leftEqual, /<name>/);
  assert.match(rightEqual, /<name>/);
  assert.equal(result.left.some(segment => segment.text === "<"), false);
  assert.equal(result.right.some(segment => segment.text === ">"), false);
});

test("references, formatting codes and literal newlines remain atomic in character mode", () => {
  const text = "[item=wood] §aValue\\n";
  const units = Array.from(diff.tokenizeProtected(text, "character"));
  const protectedValues = units.filter(unit => unit.protected).map(unit => unit.value);
  assert.deepEqual(protectedValues, ["[item=wood]", "§a", "\\n"]);
});

test("comments and section headers stay on the ordinary text path", () => {
  assert.equal(diff.parseLangLine("// comment").type, "text");
  assert.equal(diff.parseLangLine("[lang]").type, "text");
});

test("large inline comparisons use a safe fallback", () => {
  const result = diff.inlineSegments("a".repeat(300), "b".repeat(300), "character", 1000);
  assert.equal(result.fallback, true);
  assert.deepEqual(Array.from(result.left, segment => ({ ...segment })), [
    { kind: "delete", text: "a".repeat(300) }
  ]);
  assert.deepEqual(Array.from(result.right, segment => ({ ...segment })), [
    { kind: "add", text: "b".repeat(300) }
  ]);
});
