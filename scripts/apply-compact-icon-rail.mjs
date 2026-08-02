import fs from "node:fs";

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error(`Ambiguous ${label}`);
  return text.replace(from, to);
}

// HTML
const htmlPath = "src/index.html";
let html = fs.readFileSync(htmlPath, "utf8");
const oldCompact = `<div class="compact-bar" id="compactBar" style="display:none" aria-live="polite">
  <div class="compact-file" id="compactFilename"></div>
  <div class="compact-progress" id="compactProgress"></div>
  <div class="compact-save" id="compactSaveStatus"></div>
  <div class="compact-spacer"></div>
  <button type="button" class="btn ghost compact-exit" id="compactExit" data-i18n="compact.exit" data-i18n-title="compact.exitTitle"></button>
</div>
`;
const newCompact = `<div class="compact-bar" id="compactBar" style="display:none" aria-live="polite">
  <div class="compact-file" id="compactFilename"></div>
  <div class="compact-progress" id="compactProgress"></div>
  <div class="compact-save" id="compactSaveStatus"></div>
</div>

<nav class="compact-rail" id="compactRail" style="display:none" data-i18n-aria-label="compact.nav">
  <button type="button" class="compact-rail-btn" id="compactRailNav" data-compact-drawer="navigation" data-i18n-title="compact.nav"><span aria-hidden="true">☰</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailEditor" data-i18n-title="compact.editor"><span aria-hidden="true">✎</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailReview" data-i18n-title="compact.review"><span aria-hidden="true">✓</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailCompare" data-i18n-title="compact.compare"><span aria-hidden="true">⇄</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailSearch" data-i18n-title="compact.search"><span aria-hidden="true">⌕</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailFilters" data-compact-drawer="filters" data-i18n-title="compact.filters"><span aria-hidden="true">◉</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailSections" data-compact-drawer="sections" data-i18n-title="compact.sections"><span aria-hidden="true">§</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailSettings" data-i18n-title="compact.settings"><span aria-hidden="true">⚙</span></button>
  <button type="button" class="compact-rail-btn" id="compactRailMore" data-compact-drawer="more" data-i18n-title="compact.more"><span aria-hidden="true">⋯</span></button>
  <div class="compact-rail-spacer"></div>
  <button type="button" class="compact-rail-btn compact-rail-exit" id="compactRailExit" data-i18n-title="compact.exitTitle"><span aria-hidden="true">↙</span></button>
</nav>

<div class="compact-drawer-backdrop" id="compactDrawerBackdrop" hidden></div>
<aside class="compact-drawer" id="compactDrawer" role="dialog" aria-modal="true" aria-labelledby="compactDrawerTitle" hidden>
  <div class="compact-drawer-head">
    <h2 id="compactDrawerTitle" data-i18n="compact.drawerTitle"></h2>
    <button type="button" class="compact-drawer-close" id="compactDrawerClose" data-i18n="compact.closeDrawer"></button>
  </div>
  <div class="compact-drawer-body" id="compactDrawerBody"></div>
</aside>
`;
html = replaceOnce(html, oldCompact, newCompact, "compact bar markup");
fs.writeFileSync(htmlPath, html);

// Application behavior
const appPath = "src/scripts/app.js";
let app = fs.readFileSync(appPath, "utf8");
app = replaceOnce(app,
  '    compactView: false,  // non-destructive layout-only workspace state\n',
  '    compactView: false,  // non-destructive layout-only workspace state\n    compactDrawerOpen: false,\n',
  "compact drawer state"
);

app = replaceOnce(app,
  '    const bar = $("compactBar");\n    if (bar) bar.style.display = state.compactView ? "flex" : "none";\n    syncCompactBar();\n',
  '    const bar = $("compactBar");\n    if (bar) bar.style.display = state.compactView ? "flex" : "none";\n    const rail = $("compactRail");\n    if (rail) rail.style.display = state.compactView ? "flex" : "none";\n    if (!state.compactView) closeCompactDrawer({restoreFocus:false});\n    syncCompactBar();\n    syncCompactRail();\n',
  "compact layout synchronization"
);

const anchor = '  // ---------- parsing ----------\n';
const drawerCode = `  let compactDrawerInvoker = null;

  function syncCompactRail(){
    const viewMap = {editor:"compactRailEditor", review:"compactRailReview", diff:"compactRailCompare"};
    for (const [view, id] of Object.entries(viewMap)){
      const button = $(id);
      if (!button) continue;
      const active = state.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    }
    const filterButton = $("compactRailFilters");
    if (filterButton){
      filterButton.dataset.activeFilter = state.filter || "all";
      filterButton.classList.toggle("active", !["all", "missing"].includes(state.filter));
    }
  }

  function compactDrawerButton(label, onClick, options = {}){
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compact-drawer-item" + (options.active ? " active" : "");
    button.textContent = label;
    if (options.count != null){
      const count = document.createElement("span");
      count.className = "compact-drawer-count";
      count.textContent = String(options.count);
      button.append(count);
    }
    button.addEventListener("click", () => { onClick(); closeCompactDrawer(); });
    return button;
  }

  function renderCompactDrawer(kind){
    const body = $("compactDrawerBody");
    const title = $("compactDrawerTitle");
    if (!body || !title) return;
    body.replaceChildren();
    title.textContent = t(kind === "filters" ? "compact.filters" : kind === "sections" ? "compact.sections" : kind === "more" ? "compact.more" : "compact.drawerTitle");

    if (kind === "filters"){
      document.querySelectorAll("#filters .filt").forEach(original => {
        if (original.hidden) return;
        const label = original.querySelector(".l")?.textContent?.trim() || original.textContent.trim();
        const count = original.querySelector(".cnt")?.textContent;
        body.append(compactDrawerButton(label, () => original.click(), {active:original.classList.contains("on"), count}));
      });
      const terminology = document.querySelector('[data-terminology-filter], #terminologyFilter');
      if (terminology) body.append(compactDrawerButton(terminology.textContent.trim(), () => terminology.click(), {active:terminology.classList.contains("on")}));
      return;
    }

    if (kind === "sections"){
      const sections = [...document.querySelectorAll("#sections button")];
      if (!sections.length){
        const empty = document.createElement("p");
        empty.className = "compact-drawer-empty";
        empty.textContent = t("compact.noSections");
        body.append(empty);
      } else sections.forEach(original => body.append(compactDrawerButton(original.textContent.trim(), () => original.click(), {active:original.classList.contains("on")})));
      return;
    }

    if (kind === "more"){
      body.append(compactDrawerButton(t("compact.settings"), () => document.querySelector('[data-i18n="settings.button"]')?.click()));
      const note = document.createElement("p");
      note.className = "compact-drawer-empty";
      note.textContent = t("compact.moreComing");
      body.append(note);
      return;
    }

    body.append(compactDrawerButton(t("compact.editor"), () => setView("editor"), {active:state.view === "editor"}));
    body.append(compactDrawerButton(t("compact.review"), () => setView("review"), {active:state.view === "review"}));
    body.append(compactDrawerButton(t("compact.compare"), () => setView("diff"), {active:state.view === "diff"}));
    body.append(compactDrawerButton(t("compact.filters"), () => openCompactDrawer("filters", compactDrawerInvoker)));
    body.append(compactDrawerButton(t("compact.sections"), () => openCompactDrawer("sections", compactDrawerInvoker)));
  }

  function openCompactDrawer(kind = "navigation", invoker = document.activeElement){
    if (!state.compactView) return;
    compactDrawerInvoker = invoker instanceof HTMLElement ? invoker : null;
    state.compactDrawerOpen = true;
    renderCompactDrawer(kind);
    const drawer = $("compactDrawer");
    const backdrop = $("compactDrawerBackdrop");
    if (drawer) drawer.hidden = false;
    if (backdrop) backdrop.hidden = false;
    document.documentElement.classList.add("compact-drawer-open");
    requestAnimationFrame(() => $("compactDrawerClose")?.focus());
  }

  function closeCompactDrawer({restoreFocus = true} = {}){
    if (!state.compactDrawerOpen && $("compactDrawer")?.hidden !== false) return;
    state.compactDrawerOpen = false;
    const drawer = $("compactDrawer");
    const backdrop = $("compactDrawerBackdrop");
    if (drawer) drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.documentElement.classList.remove("compact-drawer-open");
    if (restoreFocus) compactDrawerInvoker?.focus();
    compactDrawerInvoker = null;
  }

`;
app = replaceOnce(app, anchor, drawerCode + anchor, "drawer function insertion point");

// Ensure rail follows existing view/filter state.
app = app.replace('  function setView(v){\n', '  function setView(v){\n');
app = app.replace(/(state\.view\s*=\s*v;)/, '$1\n    syncCompactRail();');
app = app.replace(/(state\.filter\s*=\s*f;)/, '$1\n    syncCompactRail();');

const oldEvents = `  $("compactToggle")?.addEventListener("click", () => setCompactView(!state.compactView));
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
`;
const newEvents = `  $("compactToggle")?.addEventListener("click", () => setCompactView(!state.compactView));
  $("compactRailExit")?.addEventListener("click", () => { closeCompactDrawer({restoreFocus:false}); setCompactView(false); $("compactToggle")?.focus(); });
  $("compactRailNav")?.addEventListener("click", event => openCompactDrawer("navigation", event.currentTarget));
  $("compactRailFilters")?.addEventListener("click", event => openCompactDrawer("filters", event.currentTarget));
  $("compactRailSections")?.addEventListener("click", event => openCompactDrawer("sections", event.currentTarget));
  $("compactRailMore")?.addEventListener("click", event => openCompactDrawer("more", event.currentTarget));
  $("compactRailEditor")?.addEventListener("click", () => setView("editor"));
  $("compactRailReview")?.addEventListener("click", () => setView("review"));
  $("compactRailCompare")?.addEventListener("click", () => setView("diff"));
  $("compactRailSearch")?.addEventListener("click", () => {
    const input = state.view === "review" ? $("reviewSearch") : $("search");
    input?.focus(); input?.select();
  });
  $("compactRailSettings")?.addEventListener("click", () => document.querySelector('[data-i18n="settings.button"]')?.click());
  $("compactDrawerClose")?.addEventListener("click", () => closeCompactDrawer());
  $("compactDrawerBackdrop")?.addEventListener("click", () => closeCompactDrawer());
  $("outName")?.addEventListener("input", syncCompactBar);
  if ($("saveText")) new MutationObserver(syncCompactBar).observe($("saveText"), {childList:true, characterData:true, subtree:true});
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !state.compactView) return;
    event.preventDefault();
    if (state.compactDrawerOpen){ closeCompactDrawer(); return; }
    setCompactView(false);
    $("compactToggle")?.focus();
  });
`;
app = replaceOnce(app, oldEvents, newEvents, "compact event wiring");
fs.writeFileSync(appPath, app);

// Styles
const cssPath = "src/styles/app.css";
let css = fs.readFileSync(cssPath, "utf8");
css += `

/* Compact icon rail and temporary navigation drawer */
.compact-rail{
  position:fixed; inset-block:0; inset-inline-start:0; z-index:90;
  width:52px; padding:8px 6px; box-sizing:border-box;
  flex-direction:column; align-items:center; gap:6px;
  background:var(--bg2); border-inline-end:1px solid var(--border);
}
.compact-rail-btn{
  width:40px; min-height:40px; border:1px solid transparent; border-radius:10px;
  background:transparent; color:var(--muted); font:inherit; font-size:18px; cursor:pointer;
}
.compact-rail-btn:hover,.compact-rail-btn:focus-visible{background:var(--bg3);color:var(--text);outline:2px solid var(--accent);outline-offset:1px}
.compact-rail-btn.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent)}
.compact-rail-spacer{flex:1}
.compact-rail-exit{margin-block-start:auto;color:var(--text)}
html.compact-view main,html.compact-view #compactBar{margin-inline-start:52px}
html.compact-view #compactBar{padding-inline:14px;gap:14px;min-height:42px}
html.compact-view #compactToggle{display:none!important}
.compact-drawer-backdrop{position:fixed;inset:0;z-index:94;background:rgba(0,0,0,.42)}
.compact-drawer{
  position:fixed;z-index:95;inset-block:0;inset-inline-start:52px;width:min(320px,calc(100vw - 52px));
  display:flex;flex-direction:column;background:var(--bg2);border-inline-end:1px solid var(--border);box-shadow:0 18px 50px rgba(0,0,0,.45)
}
.compact-drawer[hidden],.compact-drawer-backdrop[hidden]{display:none!important}
.compact-drawer-head{display:flex;align-items:center;gap:12px;padding:14px;border-block-end:1px solid var(--border)}
.compact-drawer-head h2{font-size:16px;margin:0;flex:1}
.compact-drawer-close{border:1px solid var(--border);border-radius:8px;background:var(--bg3);color:var(--text);padding:7px 10px;cursor:pointer}
.compact-drawer-body{padding:10px;overflow:auto;display:flex;flex-direction:column;gap:6px}
.compact-drawer-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--text);font:inherit;text-align:start;cursor:pointer}
.compact-drawer-item:hover,.compact-drawer-item:focus-visible{background:var(--bg3);outline:2px solid var(--accent);outline-offset:1px}
.compact-drawer-item.active{background:var(--accent-dim);border-color:var(--accent)}
.compact-drawer-count{margin-inline-start:auto;color:var(--muted);font-variant-numeric:tabular-nums}
.compact-drawer-empty{color:var(--muted);line-height:1.45;padding:6px 10px}
html[dir="rtl"] .compact-rail{border-inline-start:0;border-inline-end:1px solid var(--border)}
@media (max-width:640px){
  .compact-rail{width:46px;padding-inline:3px}.compact-rail-btn{width:38px}.compact-drawer{inset-inline-start:46px;width:calc(100vw - 46px)}
  html.compact-view main,html.compact-view #compactBar{margin-inline-start:46px}
  #compactBar .compact-save{max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
`;
fs.writeFileSync(cssPath, css);

// Reviewed locale strings
const messages = {
  en: {
    "compact.nav":"Compact navigation","compact.editor":"Editor","compact.review":"Review","compact.compare":"Compare","compact.search":"Search","compact.filters":"Filters","compact.sections":"Sections","compact.settings":"Settings","compact.more":"More actions","compact.drawerTitle":"Navigation","compact.closeDrawer":"Close","compact.noSections":"No sections available.","compact.moreComing":"File and machine-translation actions will move here in the next Compact view stage."
  },
  bg: {
    "compact.nav":"Компактна навигация","compact.editor":"Редактор","compact.review":"Преглед","compact.compare":"Сравнение","compact.search":"Търсене","compact.filters":"Филтри","compact.sections":"Раздели","compact.settings":"Настройки","compact.more":"Още действия","compact.drawerTitle":"Навигация","compact.closeDrawer":"Затвори","compact.noSections":"Няма налични раздели.","compact.moreComing":"Действията за файлове и машинен превод ще бъдат преместени тук в следващия етап на компактния изглед."
  },
  ru: {
    "compact.nav":"Компактная навигация","compact.editor":"Редактор","compact.review":"Проверка","compact.compare":"Сравнение","compact.search":"Поиск","compact.filters":"Фильтры","compact.sections":"Разделы","compact.settings":"Настройки","compact.more":"Другие действия","compact.drawerTitle":"Навигация","compact.closeDrawer":"Закрыть","compact.noSections":"Нет доступных разделов.","compact.moreComing":"Действия с файлами и машинным переводом будут перенесены сюда на следующем этапе компактного режима."
  }
};
for (const [code, additions] of Object.entries(messages)){
  const path = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(fs.readFileSync(path, "utf8"));
  Object.assign(locale.messages, additions);
  fs.writeFileSync(path, JSON.stringify(locale, null, 2) + "\n");
}

console.log("Applied Compact icon rail and drawer implementation.");
