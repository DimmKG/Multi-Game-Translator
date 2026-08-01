import fs from "node:fs";

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error(`Ambiguous ${label}`);
  return text.replace(from, to);
}

let app = fs.readFileSync("src/scripts/app.js", "utf8");
app = replaceOnce(
  app,
  '    scope.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });\n',
  '    scope.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });\n    scope.querySelectorAll("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });\n',
  "localized aria-label support"
);
app = replaceOnce(
  app,
  '    $("diffOnlyToggle").classList.toggle("on", state.diffOnly);\n',
  '    $("diffOnlyToggle").classList.toggle("on", state.diffOnly);\n    syncDiffModeControls();\n',
  "Compare mode synchronization"
);
fs.writeFileSync("src/scripts/app.js", app);

let css = fs.readFileSync("src/styles/app.css", "utf8");
css = css
  .replaceAll("var(--ink-muted)", "var(--ink-dim)")
  .replaceAll("var(--surface-2)", "var(--panel-2)")
  .replaceAll("var(--accent-soft)", "var(--torch-soft)")
  .replaceAll("var(--accent)", "var(--torch)");
fs.writeFileSync("src/styles/app.css", css);

let test = fs.readFileSync("test/token-aware-diff-integration.test.mjs", "utf8");
test = test
  .replace('  assert.match(app, /compareEntryPair(left, right, state.diffMode)/);', '  assert.ok(app.includes("compareEntryPair(left, right, state.diffMode)"));')
  .replace('  assert.match(css, /@media (max-width:760px)/);', '  assert.ok(css.includes("@media (max-width:760px)"));');
test = replaceOnce(
  test,
  '  assert.match(html, /data-diff-mode="character"/);\n',
  '  assert.match(html, /data-diff-mode="character"/);\n  assert.match(html, /data-i18n-aria-label="diff.inlineMode"/);\n  assert.ok(app.includes("data-i18n-aria-label"));\n',
  "Compare accessibility assertions"
);
test = replaceOnce(
  test,
  '  assert.match(css, /\\.diff-mode-btn:focus-visible/);\n',
  '  assert.match(css, /\\.diff-mode-btn:focus-visible/);\n  assert.ok(!css.includes("--ink-muted"));\n  assert.ok(!css.includes("--surface-2"));\n  assert.ok(!css.includes("--accent-soft"));\n',
  "Compare CSS variable assertions"
);
fs.writeFileSync("test/token-aware-diff-integration.test.mjs", test);

console.log("Applied Compare integration test, theme, and accessibility fixes.");
