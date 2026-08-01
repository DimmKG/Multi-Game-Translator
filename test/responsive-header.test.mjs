import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");
const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");

test("header keeps top-level controls compact and aligned", () => {
  assert.match(css, /compact localized header revision/);
  assert.match(css, /header\{[^}]*display:flex[^}]*flex-wrap:wrap/s);
  assert.match(css, /header>\.brand\{[^}]*margin-inline-end:auto/s);
  assert.match(css, /header>button\{[^}]*white-space:nowrap/s);
});

test("file actions stay on one low scrollable row", () => {
  assert.match(css, /\.filebar\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto[^}]*overflow-y:hidden/s);
  assert.match(css, /\.filebar \.btn\{[^}]*white-space:nowrap/s);
  assert.match(css, /#btnEnRef,#btnSaveJson,#btnLoadJson,#btnNew,#btnExport\{[^}]*min-width:max-content/s);
});

test("responsive layout preserves editor height instead of stacking action buttons", () => {
  assert.match(css, /@media \(max-width:900px\)[\s\S]*header>\.meter\{[^}]*flex:1 1 100%/);
  assert.doesNotMatch(css.slice(css.lastIndexOf("compact localized header revision")), /\.filebar\{[^}]*flex-wrap:wrap/s);
});

test("header keeps all existing controls and file actions", () => {
  for (const id of ["uiLang", "meter", "savePill", "btnEnRef", "btnSaveJson", "btnLoadJson", "btnNew", "outName", "btnExport"]) {
    assert.match(html, new RegExp("id=[\"']" + id + "[\"']"));
  }
});
