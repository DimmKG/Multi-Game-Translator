import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error(`Ambiguous ${label}`);
  return text.replace(from, to);
};

// HTML -----------------------------------------------------------------------
const htmlPath = "src/index.html";
let html = read(htmlPath);
html = replaceOnce(
  html,
  '  <select id="uiLang" class="uilang" aria-label="Interface language"></select>\n',
  '  <select id="uiLang" class="uilang" aria-label="Interface language"></select>\n' +
  '  <button type="button" class="btn ghost compact-toggle" id="compactToggle" data-i18n="compact.enter" data-i18n-title="compact.enterTitle" aria-pressed="false"></button>\n',
  "Compact view toggle"
);
html = replaceOnce(
  html,
  "<main>\n",
  `<div class="compact-bar" id="compactBar" style="display:none" aria-live="polite">
  <div class="compact-file" id="compactFilename"></div>
  <div class="compact-progress" id="compactProgress"></div>
  <div class="compact-save" id="compactSaveStatus"></div>
  <div class="compact-spacer"></div>
  <button type="button" class="btn ghost compact-exit" id="compactExit" data-i18n="compact.exit" data-i18n-title="compact.exitTitle"></button>
</div>

<main>\n`,
  "Compact workspace bar"
);
write(htmlPath, html);

// CSS ------------------------------------------------------------------------
const cssPath = "src/styles/app.css";
let css = read(cssPath);
css += `

/* Compact translation workspace foundation */
.compact-toggle{white-space:nowrap}
.compact-bar{
  position:sticky;
  top:0;
  z-index:45;
  min-height:42px;
  display:flex;
  align-items:center;
  gap:12px;
  padding:6px 16px;
  border-bottom:1px solid var(--line);
  background:var(--panel);
  box-shadow:0 8px 22px rgba(0,0,0,.18);
}
.compact-file,.compact-progress,.compact-save{
  min-width:0;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.compact-file{max-width:min(34vw,420px);font-family:var(--editor-font,ui-monospace,monospace);font-weight:700;color:var(--ink)}
.compact-progress{color:var(--ink-dim)}
.compact-save{color:var(--ink-dim)}
.compact-spacer{flex:1 1 auto}
.compact-exit{flex:0 0 auto;margin-inline-start:auto}
html.compact-view header,
html.compact-view #side,
html.compact-view #mtbar,
html.compact-view #footnote{display:none!important}
html.compact-view main{grid-template-columns:minmax(0,1fr)}
html.compact-view #work{min-width:0}
html.compact-view #compactBar{display:flex!important}
html[dir="rtl"] .compact-file,
html[dir="rtl"] .compact-progress,
html[dir="rtl"] .compact-save{direction:ltr;unicode-bidi:isolate;text-align:left}
@media (max-width:760px){
  .compact-bar{gap:8px;padding-inline:10px}
  .compact-file{max-width:38vw}
  .compact-progress{font-size:.86em}
  .compact-save{display:none}
  .compact-exit{padding-inline:10px}
}
@media (max-width:480px){
  .compact-progress{display:none}
  .compact-file{max-width:58vw}
}
`;
write(cssPath, css);

// Locales --------------------------------------------------------------------
const localeMessages = {
  en: {
    "compact.enter": "Compact view",
    "compact.enterTitle": "Hide secondary panels and provide more space for translation.",
    "compact.exit": "Normal view",
    "compact.exitTitle": "Restore the full workspace controls.",
    "compact.unnamed": "Unnamed translation",
    "compact.progress": "{done} / {total} translated"
  },
  bg: {
    "compact.enter": "Компактен изглед",
    "compact.enterTitle": "Скрива второстепенните панели и освобождава повече място за превода.",
    "compact.exit": "Нормален изглед",
    "compact.exitTitle": "Връща всички контроли на работното пространство.",
    "compact.unnamed": "Превод без име",
    "compact.progress": "{done} / {total} преведени"
  },
  ru: {
    "compact.enter": "Компактный вид",
    "compact.enterTitle": "Скрывает второстепенные панели и освобождает больше места для перевода.",
    "compact.exit": "Обычный вид",
    "compact.exitTitle": "Возвращает все элементы управления рабочей области.",
    "compact.unnamed": "Перевод без имени",
    "compact.progress": "{done} / {total} переведено"
  }
};
for (const [code, messages] of Object.entries(localeMessages)) {
  const path = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(read(path));
  Object.assign(locale.messages, messages);
  write(path, JSON.stringify(locale, null, 2) + "\n");
}

// Application state and synchronization --------------------------------------
const appPath = "src/scripts/app.js";
let app = read(appPath);
app = replaceOnce(
  app,
  '    diffMode: "word",   // inline Compare granularity: word | character\n',
  '    diffMode: "word",   // inline Compare granularity: word | character\n    compactView: false,  // non-destructive layout-only workspace state\n',
  "Compact view state"
);
app = replaceOnce(
  app,
  "  // ---------- parsing ----------\n",
  `  // ---------- Compact workspace layout ----------
  function compactCounts(){
    let total = 0, done = 0;
    for (const item of state.items){
      if (item.type !== "entry") continue;
      total++;
      if (statusOf(item) !== "missing") done++;
    }
    return {done, total};
  }

  function syncCompactBar(){
    const filename = $("compactFilename");
    const progress = $("compactProgress");
    const save = $("compactSaveStatus");
    if (!filename || !progress || !save) return;
    const liveName = ($("outName")?.value || state.filename || "").trim();
    filename.textContent = liveName || t("compact.unnamed");
    filename.title = filename.textContent;
    const count = compactCounts();
    progress.textContent = t("compact.progress", count);
    save.textContent = $("saveText")?.textContent || t("save.saved");
  }

  function setCompactView(enabled){
    state.compactView = !!enabled && state.items.length > 0;
    document.documentElement.classList.toggle("compact-view", state.compactView);
    const toggle = $("compactToggle");
    if (toggle) toggle.setAttribute("aria-pressed", state.compactView ? "true" : "false");
    const bar = $("compactBar");
    if (bar) bar.style.display = state.compactView ? "flex" : "none";
    syncCompactBar();
  }

  // ---------- parsing ----------\n`,
  "Compact view functions"
);
app = replaceOnce(
  app,
  "  function refreshMeter(){\n",
  "  function refreshMeter(){\n    syncCompactBar();\n",
  "Compact progress synchronization"
);
app = replaceOnce(
  app,
  '    $("outName").value = state.filename;\n',
  '    $("outName").value = state.filename;\n    $("compactToggle").disabled = false;\n    setCompactView(state.compactView);\n',
  "Compact workspace activation"
);
app = replaceOnce(
  app,
  "  // restore banner\n",
  `  $("compactToggle")?.addEventListener("click", () => setCompactView(!state.compactView));
  $("compactExit")?.addEventListener("click", () => setCompactView(false));
  $("outName")?.addEventListener("input", syncCompactBar);
  if ($("saveText")) new MutationObserver(syncCompactBar).observe($("saveText"), {childList:true, characterData:true, subtree:true});
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.compactView){
      event.preventDefault();
      setCompactView(false);
      $("compactToggle")?.focus();
    }
  });

  // restore banner\n`,
  "Compact view event wiring"
);
app = replaceOnce(
  app,
  "    document.title = t(\"app.title\");\n",
  "    document.title = t(\"app.title\");\n    if (typeof syncCompactBar === \"function\") syncCompactBar();\n",
  "Compact locale synchronization"
);
write(appPath, app);

console.log("Applied Compact view foundation.");
