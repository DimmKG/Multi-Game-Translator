import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");

test("same status requires a matched loaded reference", () => {
  assert.match(app, /e\.markedSame && e\.ref != null/);
  assert.match(app, /function hasUsableReference\(\)/);
  assert.match(app, /sameFilter\.hidden = !available/);
  assert.match(app, /reviewSame\.hidden = !available/);
});

test("same controls only render for matched reference entries", () => {
  assert.match(app, /if \(e\.ref != null\)\{[\s\S]*className = "samebtn"/);
  assert.match(app, /const sameEng = \(e\.ref != null/);
});

test("new targets and replacement references clear stale reference state", () => {
  assert.match(app, /state\.referenceFilename = "";/);
  assert.match(app, /delete e\.ref;[\s\S]*const r = map\.get\(e\.key\)/);
});

test("explicit SAME_TRANSLATION markers remain lossless on export", () => {
  assert.match(app, /if \(it\.markedSame\) out\.push\(SAME/);
});

test("reference-dependent filter controls remain present in the document", () => {
  assert.match(html, /data-f="same"/);
  assert.match(html, /data-r="same"/);
});
