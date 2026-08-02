import fs from "node:fs";

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error(`Ambiguous ${label}`);
  return text.replace(from, to);
}

// HTML: add one Actions entry before Settings.
const htmlPath = "src/index.html";
let html = fs.readFileSync(htmlPath, "utf8");
html = replaceOnce(
  html,
  '  <button type="button" class="compact-rail-btn" id="compactRailSettings" data-i18n-title="compact.settings"><span aria-hidden="true">⚙</span></button>\n',
  '  <button type="button" class="compact-rail-btn" id="compactRailActions" data-compact-drawer="actions" data-i18n-title="compact.actions"><span aria-hidden="true">⋯</span></button>\n  <button type="button" class="compact-rail-btn" id="compactRailSettings" data-i18n-title="compact.settings"><span aria-hidden="true">⚙</span></button>\n',
  "Compact Actions rail entry"
);
fs.writeFileSync(htmlPath, html);

// App behavior.
const appPath = "src/scripts/app.js";
let app = fs.readFileSync(appPath, "utf8");

app = replaceOnce(
  app,
  '    title.textContent = t(kind === "filters" ? "compact.filters" : kind === "sections" ? "compact.sections" : "compact.drawerTitle");\n',
  '    title.textContent = t(kind === "filters" ? "compact.filters" : kind === "sections" ? "compact.sections" : kind === "actions" ? "compact.actions" : "compact.drawerTitle");\n',
  "drawer title routing"
);

const sectionsAnchor = `    if (kind === "sections"){
      const sections = [...document.querySelectorAll("#sections button")];
      if (!sections.length){
        const empty = document.createElement("p");
        empty.className = "compact-drawer-empty";
        empty.textContent = t("compact.noSections");
        body.append(empty);
      } else sections.forEach(original => body.append(compactDrawerButton(original.textContent.trim(), () => original.click(), {active:original.classList.contains("on")})));
      return;
    }

`;
const actionsCode = `    if (kind === "actions"){
      renderCompactActions(body);
      return;
    }

`;
app = replaceOnce(app, sectionsAnchor, sectionsAnchor + actionsCode, "Actions drawer route");

const insertAnchor = '  function openCompactDrawer(kind = "navigation", invoker = document.activeElement){\n';
const actionFunctions = `  function compactActionHeading(key){
    const heading = document.createElement("h3");
    heading.className = "compact-actions-heading";
    heading.textContent = t(key);
    return heading;
  }

  function compactActionProxy(labelKey, controlId, options = {}){
    const original = $(controlId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compact-drawer-item compact-action-button" + (options.primary ? " primary" : "");
    button.textContent = t(labelKey);
    button.disabled = !original || original.disabled;
    button.addEventListener("click", () => {
      closeCompactDrawer({restoreFocus:false});
      original?.click();
    });
    return button;
  }

  function compactToggleProxy(labelKey, controlId){
    const original = $(controlId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compact-drawer-item compact-action-toggle";
    const sync = () => {
      const on = original?.classList.contains("on") ?? false;
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
      button.textContent = t(labelKey);
    };
    sync();
    button.addEventListener("click", () => { original?.click(); sync(); });
    return button;
  }

  function compactSelectProxy(labelKey, controlId){
    const original = $(controlId);
    const wrap = document.createElement("label");
    wrap.className = "compact-actions-field";
    const label = document.createElement("span");
    label.textContent = t(labelKey);
    const select = document.createElement("select");
    select.className = "compact-actions-select";
    if (original){
      select.innerHTML = original.innerHTML;
      select.value = original.value;
      select.disabled = original.disabled;
      select.addEventListener("change", () => {
        original.value = select.value;
        original.dispatchEvent(new Event("change", {bubbles:true}));
        select.value = original.value;
      });
    } else select.disabled = true;
    wrap.append(label, select);
    return wrap;
  }

  function compactInputProxy(labelKey, controlId){
    const original = $(controlId);
    const wrap = document.createElement("label");
    wrap.className = "compact-actions-field";
    const label = document.createElement("span");
    label.textContent = t(labelKey);
    const input = document.createElement("input");
    input.className = "compact-actions-input";
    input.type = "text";
    input.spellcheck = false;
    input.value = original?.value || "";
    input.disabled = !original || original.disabled;
    const commit = () => {
      if (!original) return;
      original.value = input.value;
      original.dispatchEvent(new Event("input", {bubbles:true}));
      original.dispatchEvent(new Event("change", {bubbles:true}));
      input.value = original.value;
    };
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter"){ event.preventDefault(); commit(); input.blur(); }
    });
    wrap.append(label, input);
    return wrap;
  }

  function renderCompactActions(body){
    const fileGroup = document.createElement("section");
    fileGroup.className = "compact-actions-group";
    fileGroup.append(
      compactActionHeading("compact.fileActions"),
      compactActionProxy("compact.referenceFile", "btnEnRef"),
      compactActionProxy("compact.saveProgress", "btnSaveJson"),
      compactActionProxy("compact.loadProgress", "btnLoadJson"),
      compactActionProxy("compact.newFile", "btnNew"),
      compactActionProxy("compact.exportFile", "btnExport", {primary:true})
    );
    body.append(fileGroup);

    if (state.view === "editor"){
      const tools = document.createElement("section");
      tools.className = "compact-actions-group compact-actions-translation";
      tools.append(
        compactActionHeading("compact.translationTools"),
        compactSelectProxy("mt.label", "mtProvider"),
        compactInputProxy("mt.langLabel", "mtTarget"),
        compactToggleProxy("toggle.spell", "spellToggle"),
        compactToggleProxy("toggle.ac", "acToggle")
      );
      body.append(tools);
    }
  }

`;
app = replaceOnce(app, insertAnchor, actionFunctions + insertAnchor, "Actions functions insertion");

app = replaceOnce(
  app,
  '  $("compactRailSections")?.addEventListener("click", event => openCompactDrawer("sections", event.currentTarget));\n',
  '  $("compactRailSections")?.addEventListener("click", event => openCompactDrawer("sections", event.currentTarget));\n  $("compactRailActions")?.addEventListener("click", event => openCompactDrawer("actions", event.currentTarget));\n',
  "Actions rail event"
);
fs.writeFileSync(appPath, app);

// CSS.
const cssPath = "src/styles/app.css";
let css = fs.readFileSync(cssPath, "utf8");
css += `

/* Compact workspace actions */
.compact-actions-group{display:grid;gap:8px;padding-block:4px 14px}
.compact-actions-group + .compact-actions-group{border-block-start:1px solid var(--border);padding-block-start:14px}
.compact-actions-heading{margin:0 4px 2px;font-size:12px;line-height:1.3;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.compact-action-button.primary{border-color:var(--accent);color:var(--accent)}
.compact-action-toggle{justify-content:flex-start}
.compact-actions-field{display:grid;gap:6px;padding:7px 4px;color:var(--muted);font-size:12px}
.compact-actions-select,.compact-actions-input{width:100%;min-width:0;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;background:var(--bg3);color:var(--text);padding:9px 10px;font:inherit}
.compact-actions-select:focus-visible,.compact-actions-input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
html[dir="rtl"] .compact-actions-heading,html[dir="rtl"] .compact-actions-field{text-align:start}
@media (max-width:560px){.compact-actions-group{padding-inline:2px}.compact-actions-select,.compact-actions-input{font-size:16px}}
`;
fs.writeFileSync(cssPath, css);

// Reviewed locales. Existing messages are preserved exactly.
const messages = {
  en: {
    "compact.actions": "Actions",
    "compact.fileActions": "File actions",
    "compact.translationTools": "Translation tools",
    "compact.referenceFile": "Load reference file",
    "compact.saveProgress": "Save progress",
    "compact.loadProgress": "Load progress",
    "compact.newFile": "New file",
    "compact.exportFile": "Export translation"
  },
  bg: {
    "compact.actions": "Действия",
    "compact.fileActions": "Файлови действия",
    "compact.translationTools": "Инструменти за превод",
    "compact.referenceFile": "Зареждане на референтен файл",
    "compact.saveProgress": "Запазване на напредъка",
    "compact.loadProgress": "Зареждане на напредъка",
    "compact.newFile": "Нов файл",
    "compact.exportFile": "Експортиране на превода"
  },
  ru: {
    "compact.actions": "Действия",
    "compact.fileActions": "Действия с файлами",
    "compact.translationTools": "Инструменты перевода",
    "compact.referenceFile": "Загрузить файл-образец",
    "compact.saveProgress": "Сохранить прогресс",
    "compact.loadProgress": "Загрузить прогресс",
    "compact.newFile": "Новый файл",
    "compact.exportFile": "Экспортировать перевод"
  }
};
for (const [code, additions] of Object.entries(messages)){
  const path = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(fs.readFileSync(path, "utf8"));
  Object.assign(locale.messages, additions);
  fs.writeFileSync(path, JSON.stringify(locale, null, 2) + "\n");
}

console.log("Applied Compact workspace actions and translation tools.");
