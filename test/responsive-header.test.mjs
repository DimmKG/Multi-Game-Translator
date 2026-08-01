import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");

test("header uses a two-row capable grid layout", () => {
  assert.match(css, /header\{[^}]*display:grid[^}]*grid-template-columns:/s);
  assert.match(css, /\.filebar\{[^}]*grid-column:1\/-1[^}]*flex-wrap:wrap/s);
  assert.match(css, /@media \(max-width:900px\)/);
});

test("localized action labels are not clipped by fixed widths", () => {
  assert.doesNotMatch(css, /#btnEnRef\{width:148px/);
  assert.doesNotMatch(css, /#btnSaveJson,#btnLoadJson\{width:158px/);
  assert.match(css, /#btnEnRef,#btnSaveJson,#btnLoadJson,#btnNew,#btnExport\{[^}]*width:auto/s);
  assert.match(css, /\.btn\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/s);
});

test("header keeps all existing controls and file actions", () => {
  for (const id of ["uiLang", "meter", "savePill", "btnEnRef", "btnSaveJson", "btnLoadJson", "btnNew", "outName", "btnExport"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});
