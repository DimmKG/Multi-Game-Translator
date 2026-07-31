import { fetchCatalog, fetchGlossary, loadLocalGlossary } from "./loader.js";

const STORAGE_KEY = "necesse-translator.glossaries.v1";
const DEFAULT_CATALOG = "./glossaries/catalog.json";
const state = { records: [], catalog: null, listeners: new Set() };
const ui = {};
const t = key => globalThis.NecesseI18n?.t(`glossary.${key}`) || key;
const onlineAvailable = () => location.protocol === "http:" || location.protocol === "https:";

function restore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) state.records = parsed.filter(item => item && item.glossary && typeof item.enabled === "boolean");
  } catch { state.records = []; }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  state.listeners.forEach(listener => listener(getEnabledGlossaries()));
}

function getEnabledGlossaries() {
  return state.records.filter(item => item.enabled).map(item => item.glossary);
}

function addGlossary(glossary, source) {
  const index = state.records.findIndex(item => item.glossary.id === glossary.id);
  const record = { enabled: index >= 0 ? state.records[index].enabled : true, source, glossary };
  if (index >= 0) state.records.splice(index, 1, record); else state.records.push(record);
  persist();
  render();
  setStatus(index >= 0 ? t("replaced") : t("loaded"));
}

function removeGlossary(id) {
  state.records = state.records.filter(item => item.glossary.id !== id);
  persist();
  render();
  setStatus(t("removed"));
}

function setStatus(message, isError = false) {
  if (!ui.status) return;
  ui.status.textContent = message;
  ui.status.dataset.error = isError ? "true" : "false";
}

function glossaryCard(record) {
  const card = document.createElement("div");
  card.className = "gm-card";
  const info = document.createElement("div");
  info.className = "gm-info";
  const title = document.createElement("strong");
  title.textContent = record.glossary.name;
  const meta = document.createElement("span");
  meta.textContent = `${record.glossary.sourceLanguage} → ${record.glossary.targetLanguage} · ${record.glossary.entries.length} ${t("entries")}`;
  info.append(title, meta);
  const toggle = document.createElement("button");
  toggle.className = `gm-toggle${record.enabled ? " on" : ""}`;
  toggle.textContent = record.enabled ? t("enabled") : t("disabled");
  toggle.addEventListener("click", () => { record.enabled = !record.enabled; persist(); render(); });
  const remove = document.createElement("button");
  remove.className = "gm-remove";
  remove.textContent = t("remove");
  remove.addEventListener("click", () => removeGlossary(record.glossary.id));
  card.append(info, toggle, remove);
  return card;
}

function renderCatalog() {
  ui.catalogList.replaceChildren();
  if (!onlineAvailable()) {
    const note = document.createElement("p"); note.className = "gm-note"; note.textContent = t("offline"); ui.catalogList.append(note); return;
  }
  if (!state.catalog) return;
  if (!state.catalog.glossaries.length) {
    const note = document.createElement("p"); note.className = "gm-note"; note.textContent = t("catalogEmpty"); ui.catalogList.append(note); return;
  }
  for (const entry of state.catalog.glossaries) {
    const row = document.createElement("div"); row.className = "gm-catalog-row";
    const label = document.createElement("span"); label.textContent = `${entry.name} · ${entry.sourceLanguage} → ${entry.targetLanguage}`;
    const button = document.createElement("button"); button.textContent = t("install");
    button.addEventListener("click", async () => {
      button.disabled = true; button.textContent = t("loading");
      try { addGlossary(await fetchGlossary(entry.url), "catalog"); }
      catch (error) { setStatus(t("error") + error.message, true); }
      finally { button.disabled = false; button.textContent = t("install"); }
    });
    row.append(label, button); ui.catalogList.append(row);
  }
}

function render() {
  if (!ui.dialog) return;
  ui.open.textContent = t("button"); ui.title.textContent = t("title"); ui.intro.textContent = t("intro");
  ui.import.textContent = t("import"); ui.catalogButton.textContent = t("catalog"); ui.localTitle.textContent = t("local");
  ui.onlineTitle.textContent = t("online"); ui.close.textContent = t("close");
  ui.catalogButton.hidden = !onlineAvailable();
  ui.localList.replaceChildren();
  if (!state.records.length) { const p = document.createElement("p"); p.className = "gm-note"; p.textContent = t("empty"); ui.localList.append(p); }
  else state.records.forEach(record => ui.localList.append(glossaryCard(record)));
  renderCatalog();
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `.gm-open{margin-left:8px}.gm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;z-index:1000;padding:24px}.gm-backdrop.open{display:flex}.gm-dialog{width:min(760px,100%);max-height:86vh;overflow:auto;background:var(--panel,#171a20);border:1px solid var(--line,#343944);border-radius:14px;padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.45)}.gm-head{display:flex;gap:16px;align-items:flex-start}.gm-head h2{margin:0 0 6px}.gm-head p{margin:0;color:var(--muted,#9aa3b2)}.gm-head .grow{flex:1}.gm-actions{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.gm-section{margin-top:20px}.gm-section h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#9aa3b2)}.gm-list{display:grid;gap:8px}.gm-card,.gm-catalog-row{display:flex;gap:10px;align-items:center;padding:11px;border:1px solid var(--line,#343944);border-radius:9px}.gm-info{display:grid;gap:4px;flex:1}.gm-info span,.gm-note{font-size:12px;color:var(--muted,#9aa3b2)}.gm-toggle.on{border-color:#5da56d}.gm-remove{opacity:.8}.gm-status{min-height:20px;margin-top:12px;font-size:12px}.gm-status[data-error=true]{color:#ff7f7f}.gm-close{font-size:18px;line-height:1;padding:6px 9px}@media(max-width:650px){.gm-card,.gm-catalog-row{align-items:stretch;flex-direction:column}.gm-card button,.gm-catalog-row button{width:100%}}`;
  document.head.append(style);
}

function buildUi() {
  injectStyles();
  ui.open = document.createElement("button"); ui.open.className = "btn ghost gm-open";
  document.getElementById("uiLang")?.insertAdjacentElement("afterend", ui.open);
  ui.backdrop = document.createElement("div"); ui.backdrop.className = "gm-backdrop";
  ui.dialog = document.createElement("section"); ui.dialog.className = "gm-dialog"; ui.dialog.setAttribute("role", "dialog"); ui.dialog.setAttribute("aria-modal", "true");
  const head = document.createElement("div"); head.className = "gm-head";
  const heading = document.createElement("div"); ui.title = document.createElement("h2"); ui.intro = document.createElement("p"); heading.append(ui.title, ui.intro);
  const grow = document.createElement("div"); grow.className = "grow"; ui.close = document.createElement("button"); ui.close.className = "gm-close";
  head.append(heading, grow, ui.close);
  const actions = document.createElement("div"); actions.className = "gm-actions";
  ui.import = document.createElement("button"); ui.import.className = "btn primary"; ui.catalogButton = document.createElement("button"); ui.catalogButton.className = "btn ghost";
  ui.file = document.createElement("input"); ui.file.type = "file"; ui.file.accept = ".json,application/json"; ui.file.hidden = true;
  actions.append(ui.import, ui.catalogButton, ui.file);
  const local = document.createElement("section"); local.className = "gm-section"; ui.localTitle = document.createElement("h3"); ui.localList = document.createElement("div"); ui.localList.className = "gm-list"; local.append(ui.localTitle, ui.localList);
  const online = document.createElement("section"); online.className = "gm-section"; ui.onlineTitle = document.createElement("h3"); ui.catalogList = document.createElement("div"); ui.catalogList.className = "gm-list"; online.append(ui.onlineTitle, ui.catalogList);
  ui.status = document.createElement("div"); ui.status.className = "gm-status";
  ui.dialog.append(head, actions, local, online, ui.status); ui.backdrop.append(ui.dialog); document.body.append(ui.backdrop);
  ui.open.addEventListener("click", () => { ui.backdrop.classList.add("open"); render(); });
  ui.close.addEventListener("click", () => ui.backdrop.classList.remove("open"));
  ui.backdrop.addEventListener("click", event => { if (event.target === ui.backdrop) ui.backdrop.classList.remove("open"); });
  ui.import.addEventListener("click", () => ui.file.click());
  ui.file.addEventListener("change", async () => {
    const file = ui.file.files?.[0]; if (!file) return;
    try { addGlossary(await loadLocalGlossary(file), "local"); }
    catch (error) { setStatus(t("error") + error.message, true); }
    finally { ui.file.value = ""; }
  });
  ui.catalogButton.addEventListener("click", async () => {
    ui.catalogButton.disabled = true; setStatus(t("loading"));
    try { state.catalog = await fetchCatalog(DEFAULT_CATALOG); setStatus(""); renderCatalog(); }
    catch (error) { setStatus(t("error") + error.message, true); }
    finally { ui.catalogButton.disabled = false; }
  });
  document.getElementById("uiLang")?.addEventListener("change", render);
}

restore();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { buildUi(); render(); });
else { buildUi(); render(); }

globalThis.NecesseGlossaries = Object.freeze({
  getAll: () => state.records.map(item => ({ enabled: item.enabled, source: item.source, glossary: item.glossary })),
  getEnabled: getEnabledGlossaries,
  subscribe(listener) { if (typeof listener !== "function") throw new TypeError("Listener must be a function."); state.listeners.add(listener); return () => state.listeners.delete(listener); }
});
