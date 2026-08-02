import fs from "node:fs";

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error(`Ambiguous ${label}`);
  return text.replace(from, to);
}

// Remove the premature More entry and mark contextual rail tools.
const htmlPath = "src/index.html";
let html = fs.readFileSync(htmlPath, "utf8");
html = replaceOnce(
  html,
  '  <button type="button" class="compact-rail-btn" id="compactRailSearch" data-i18n-title="compact.search"><span aria-hidden="true">⌕</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailFilters" data-compact-drawer="filters" data-i18n-title="compact.filters"><span aria-hidden="true">◉</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailSections" data-compact-drawer="sections" data-i18n-title="compact.sections"><span aria-hidden="true">§</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailSettings" data-i18n-title="compact.settings"><span aria-hidden="true">⚙</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailMore" data-compact-drawer="more" data-i18n-title="compact.more"><span aria-hidden="true">⋯</span></button>\n',
  '  <button type="button" class="compact-rail-btn" id="compactRailSearch" data-compact-views="editor review" data-i18n-title="compact.search"><span aria-hidden="true">⌕</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailFilters" data-compact-views="editor" data-compact-drawer="filters" data-i18n-title="compact.filters"><span aria-hidden="true">◉</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailSections" data-compact-views="editor" data-compact-drawer="sections" data-i18n-title="compact.sections"><span aria-hidden="true">§</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailSettings" data-i18n-title="compact.settings"><span aria-hidden="true">⚙</span></button>\n',
  "contextual rail controls"
);
fs.writeFileSync(htmlPath, html);

// Make the rail context-aware and keep the navigation drawer global-only.
const appPath = "src/scripts/app.js";
let app = fs.readFileSync(appPath, "utf8");
app = replaceOnce(
  app,
  '    const filterButton = $("compactRailFilters");\n    if (filterButton){\n      filterButton.dataset.activeFilter = state.filter || "all";\n      filterButton.classList.toggle("active", !["all", "missing"].includes(state.filter));\n    }\n',
  '    document.querySelectorAll("#compactRail [data-compact-views]").forEach(button => {\n      const allowed = String(button.dataset.compactViews || "").split(/\\s+/).filter(Boolean);\n      button.hidden = !allowed.includes(state.view);\n    });\n    const filterButton = $("compactRailFilters");\n    if (filterButton){\n      filterButton.dataset.activeFilter = state.filter || "all";\n      filterButton.classList.toggle("active", !["all", "missing"].includes(state.filter));\n    }\n',
  "context-aware rail synchronization"
);
app = replaceOnce(
  app,
  '    title.textContent = t(kind === "filters" ? "compact.filters" : kind === "sections" ? "compact.sections" : kind === "more" ? "compact.more" : "compact.drawerTitle");\n',
  '    title.textContent = t(kind === "filters" ? "compact.filters" : kind === "sections" ? "compact.sections" : "compact.drawerTitle");\n',
  "drawer title selection"
);
app = replaceOnce(
  app,
  '    if (kind === "more"){\n      body.append(compactDrawerButton(t("compact.settings"), () => document.querySelector(\'[data-i18n="settings.button"]\')?.click()));\n      const note = document.createElement("p");\n      note.className = "compact-drawer-empty";\n      note.textContent = t("compact.moreComing");\n      body.append(note);\n      return;\n    }\n\n',
  '',
  "premature More drawer"
);
app = replaceOnce(
  app,
  '    body.append(compactDrawerButton(t("compact.editor"), () => setView("editor"), {active:state.view === "editor"}));\n    body.append(compactDrawerButton(t("compact.review"), () => setView("review"), {active:state.view === "review"}));\n    body.append(compactDrawerButton(t("compact.compare"), () => setView("diff"), {active:state.view === "diff"}));\n    body.append(compactDrawerButton(t("compact.filters"), () => openCompactDrawer("filters", compactDrawerInvoker)));\n    body.append(compactDrawerButton(t("compact.sections"), () => openCompactDrawer("sections", compactDrawerInvoker)));\n',
  '    body.append(compactDrawerButton(t("compact.editor"), () => setView("editor"), {active:state.view === "editor"}));\n    body.append(compactDrawerButton(t("compact.review"), () => setView("review"), {active:state.view === "review"}));\n    body.append(compactDrawerButton(t("compact.compare"), () => setView("diff"), {active:state.view === "diff"}));\n    body.append(compactDrawerButton(t("compact.settings"), () => globalThis.NecesseSettings?.open?.()));\n',
  "global-only navigation drawer"
);
app = replaceOnce(
  app,
  '  $("compactRailMore")?.addEventListener("click", event => openCompactDrawer("more", event.currentTarget));\n',
  '',
  "More event handler"
);
app = replaceOnce(
  app,
  '  $("compactRailSettings")?.addEventListener("click", () => document.querySelector(\'[data-i18n="settings.button"]\')?.click());\n',
  '  $("compactRailSettings")?.addEventListener("click", () => globalThis.NecesseSettings?.open?.());\n',
  "Settings rail handler"
);
app = replaceOnce(
  app,
  '    if (event.key !== "Escape" || !state.compactView) return;\n',
  '    if (event.key !== "Escape" || !state.compactView) return;\n    if (document.querySelector(".settings-backdrop.open")) return;\n',
  "Settings Escape precedence"
);
fs.writeFileSync(appPath, app);

// Give Settings a stable public opener instead of relying on translated DOM text.
const settingsPath = "src/scripts/settings.js";
let settings = fs.readFileSync(settingsPath, "utf8");
settings = replaceOnce(
  settings,
  '    ui.open.className = "btn ghost settings-open";\n    ui.open.textContent = "⚙";\n',
  '    ui.open.className = "btn ghost settings-open";\n    ui.open.id = "settingsOpen";\n    ui.open.textContent = "⚙";\n',
  "stable Settings trigger"
);
settings = replaceOnce(
  settings,
  '  globalThis.NecesseSettings = Object.freeze({\n    get: () => ({ ...state }),\n',
  '  globalThis.NecesseSettings = Object.freeze({\n    open() { ui.open?.click(); },\n    get: () => ({ ...state }),\n',
  "Settings public open API"
);
fs.writeFileSync(settingsPath, settings);

// Hidden contextual controls must stay out of the rail layout.
const cssPath = "src/styles/app.css";
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes('.compact-rail-btn[hidden]')) css += '\n.compact-rail-btn[hidden]{display:none!important}\n';
fs.writeFileSync(cssPath, css);

// Update the behavioral contract to the refined model.
const testPath = "test/compact-icon-rail.test.mjs";
let test = fs.readFileSync(testPath, "utf8");
test = test.replace('    "compactRailSettings",\n    "compactRailMore",\n    "compactRailExit"', '    "compactRailSettings",\n    "compactRailExit"');
test = test.replace('    "compact.settings",\n    "compact.more",\n    "compact.drawerTitle",', '    "compact.settings",\n    "compact.drawerTitle",');
test += `\n\ntest("rail tools follow the active workspace view", () => {\n  assert.ok(html.includes('id="compactRailSearch" data-compact-views="editor review"'));\n  assert.ok(html.includes('id="compactRailFilters" data-compact-views="editor"'));\n  assert.ok(html.includes('id="compactRailSections" data-compact-views="editor"'));\n  assert.ok(!html.includes('id="compactRailMore"'));\n  assert.ok(app.includes('button.hidden = !allowed.includes(state.view)'));\n});\n\ntest("navigation drawer contains only global destinations", () => {\n  assert.ok(app.includes('globalThis.NecesseSettings?.open?.()'));\n  assert.ok(!app.includes('openCompactDrawer("filters", compactDrawerInvoker)'));\n  assert.ok(!app.includes('openCompactDrawer("sections", compactDrawerInvoker)'));\n});\n`;
fs.writeFileSync(testPath, test);

console.log("Refined Compact rail into global navigation plus contextual tools.");
