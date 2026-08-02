import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("src/index.html", "utf8");
const app = fs.readFileSync("src/scripts/app.js", "utf8");
const css = fs.readFileSync("src/styles/app.css", "utf8");

const locales = ["en", "bg", "ru"].map(code =>
  JSON.parse(fs.readFileSync(`src/scripts/i18n/locales/${code}.json`, "utf8"))
);

test("Compact view exposes a persistent icon rail", () => {
  for (const id of [
    "compactRail",
    "compactRailNav",
    "compactRailEditor",
    "compactRailReview",
    "compactRailCompare",
    "compactRailSearch",
    "compactRailFilters",
    "compactRailSections",
    "compactRailSettings",
    "compactRailMore",
    "compactRailExit"
  ]) assert.ok(html.includes(`id="${id}"`), id);
});

test("Compact navigation uses a temporary accessible drawer", () => {
  assert.ok(html.includes('id="compactDrawer"'));
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));
  assert.ok(app.includes("openCompactDrawer"));
  assert.ok(app.includes("closeCompactDrawer"));
  assert.ok(app.includes("compactDrawerInvoker"));
});

test("Rail view actions reuse the existing workspace state", () => {
  assert.ok(app.includes('setView("editor")'));
  assert.ok(app.includes('setView("review")'));
  assert.ok(app.includes('setView("diff")'));
  assert.ok(app.includes("syncCompactRail"));
  assert.ok(!app.includes("compactActiveView ="));
});

test("Escape closes temporary UI before leaving Compact view", () => {
  assert.ok(app.includes("if (state.compactDrawerOpen)"));
  assert.ok(app.includes("closeCompactDrawer"));
  assert.ok(app.includes("setCompactView(false)"));
});

test("reviewed locales include icon rail and drawer messages", () => {
  const keys = [
    "compact.nav",
    "compact.editor",
    "compact.review",
    "compact.compare",
    "compact.search",
    "compact.filters",
    "compact.sections",
    "compact.settings",
    "compact.more",
    "compact.drawerTitle",
    "compact.closeDrawer"
  ];
  for (const locale of locales)
    for (const key of keys)
      assert.equal(typeof locale.messages[key], "string", `${locale.code}: ${key}`);
});

test("rail and drawer have responsive and RTL-safe styles", () => {
  assert.ok(css.includes("#compactRail"));
  assert.ok(css.includes("#compactDrawer"));
  assert.ok(css.includes("inset-inline-start"));
  assert.ok(css.includes("html[dir=\"rtl\"]"));
  assert.ok(css.includes("@media (max-width:"));
});
