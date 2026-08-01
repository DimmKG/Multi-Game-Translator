"use strict";

(function initializeSettingsTabs() {
  const STORAGE_KEY = "necesse-translator.settings-tab.v1";
  const ORDER = ["general", "fonts", "machine-translation", "secrets"];
  const FALLBACK = Object.freeze({
    general: "General",
    fonts: "Fonts",
    "machine-translation": "Machine Translation",
    secrets: "Secrets"
  });
  const state = { active: restoreActive(), tabs: new Map(), observer: null };
  const ui = {};

  function restoreActive() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return ORDER.includes(value) ? value : "general";
    } catch {
      return "general";
    }
  }

  function labelFor(id) {
    const key = `settings.tab.${id}`;
    const translated = globalThis.NecesseI18n?.t(key);
    return translated && translated !== key ? translated : FALLBACK[id];
  }

  function persistActive(id) {
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }

  function ensureTab(id) {
    if (!ORDER.includes(id) || !ui.tablist || !ui.panels) return null;
    if (state.tabs.has(id)) return state.tabs.get(id);

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "settings-tab";
    tab.id = `settings-tab-${id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `settings-panel-${id}`);
    tab.dataset.settingsTab = id;

    const panel = document.createElement("div");
    panel.className = "settings-tab-panel";
    panel.id = `settings-panel-${id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.dataset.settingsPanel = id;

    tab.addEventListener("click", () => activate(id, { focus: true }));
    ui.tablist.append(tab);
    ui.panels.append(panel);
    const record = { id, tab, panel };
    state.tabs.set(id, record);
    return record;
  }

  function activate(id, options = {}) {
    const next = state.tabs.has(id) ? id : "general";
    state.active = next;
    persistActive(next);
    for (const record of state.tabs.values()) {
      const selected = record.id === next;
      record.tab.setAttribute("aria-selected", selected ? "true" : "false");
      record.tab.tabIndex = selected ? 0 : -1;
      record.panel.hidden = !selected;
    }
    if (options.focus) state.tabs.get(next)?.tab.focus();
  }

  function register(id, element, options = {}) {
    if (!(element instanceof Element)) throw new TypeError("Settings tab content must be an Element.");
    const record = ensureTab(id);
    if (!record) throw new TypeError(`Unknown Settings tab: ${id}`);
    if (options.prepend) record.panel.prepend(element);
    else record.panel.append(element);
    return element;
  }

  function classify(element) {
    if (!(element instanceof Element)) return "general";
    if (element.matches(".font-settings-section") || element.closest?.(".font-settings-section")) return "fonts";
    if (element.matches(".settings-vault-section") || element.closest?.(".settings-vault-section")) return "secrets";
    if (element.matches(".settings-provider-section") || element.closest?.(".settings-provider-section")) return "machine-translation";
    return "general";
  }

  function adoptExisting() {
    if (!ui.legacyList) return;
    const children = [...ui.legacyList.children];
    for (const child of children) register(classify(child), child);
  }

  function handleMutations(records) {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || node === ui.tablist || node === ui.panels) continue;
        if (node.closest?.(".settings-tabs-shell")) continue;
        register(classify(node), node);
      }
    }
  }

  function handleKeys(event) {
    if (!event.target?.matches?.('[role="tab"]')) return;
    const current = ORDER.indexOf(event.target.dataset.settingsTab);
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % ORDER.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + ORDER.length) % ORDER.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ORDER.length - 1;
    else return;
    event.preventDefault();
    activate(ORDER[next], { focus: true });
  }

  function renderLabels() {
    for (const record of state.tabs.values()) record.tab.textContent = labelFor(record.id);
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `.settings-dialog{display:flex;flex-direction:column;max-height:min(760px,calc(100dvh - 32px));overflow:hidden}.settings-tabs-shell{display:flex;flex-direction:column;min-height:0;margin-top:16px}.settings-tablist{display:flex;gap:4px;overflow-x:auto;flex:0 0 auto;border-bottom:1px solid var(--line,#343944);scrollbar-width:thin}.settings-tab{flex:0 0 auto;border:1px solid transparent;border-bottom:0;border-radius:8px 8px 0 0;padding:8px 12px;background:transparent;color:var(--muted,#9aa3b2);white-space:nowrap}.settings-tab:hover{color:inherit}.settings-tab[aria-selected="true"]{background:var(--bg,#101217);border-color:var(--line,#343944);color:var(--accent,#7aa2f7);position:relative;top:1px}.settings-tab:focus-visible{outline:2px solid var(--accent,#7aa2f7);outline-offset:-2px}.settings-tab-panels{min-height:0;overflow:auto;padding:14px 2px 2px}.settings-tab-panel{display:grid;gap:10px}.settings-tab-panel[hidden]{display:none!important}.settings-list{margin-top:0}.settings-tabs-shell .settings-provider-section,.settings-tabs-shell .font-settings-section{margin-top:0}@media(max-width:620px){.settings-backdrop{padding:8px}.settings-dialog{max-height:calc(100dvh - 16px);padding:16px}.settings-tab{padding:8px 10px}}`;
    document.head.append(style);
  }

  function initialize() {
    const list = document.querySelector(".settings-list");
    if (!list || list.closest(".settings-tabs-shell")) return;
    ui.legacyList = list;
    ui.shell = document.createElement("div");
    ui.shell.className = "settings-tabs-shell";
    ui.tablist = document.createElement("div");
    ui.tablist.className = "settings-tablist";
    ui.tablist.setAttribute("role", "tablist");
    ui.tablist.setAttribute("aria-label", "Settings sections");
    ui.panels = document.createElement("div");
    ui.panels.className = "settings-tab-panels";
    ui.shell.append(ui.tablist, ui.panels);
    list.replaceWith(ui.shell);

    for (const id of ORDER) ensureTab(id);
    adoptExisting();
    ui.tablist.addEventListener("keydown", handleKeys);
    injectStyles();
    renderLabels();
    activate(state.active);

    state.observer = new MutationObserver(handleMutations);
    state.observer.observe(ui.legacyList, { childList: true });
    document.getElementById("uiLang")?.addEventListener("change", renderLabels);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else queueMicrotask(initialize);

  globalThis.NecesseSettingsTabs = Object.freeze({ register, activate, get active() { return state.active; } });
})();
