"use strict";

(function initializeSettings() {
  const STORAGE_KEY = "necesse-translator.settings.v1";
  const defaults = Object.freeze({ referenceReminder: true });
  const state = { ...defaults, ...restore() };
  const ui = {};
  let observer = null;

  const t = key => globalThis.NecesseI18n?.t(`settings.${key}`) || `settings.${key}`;

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    applyReferenceReminder();
  }

  function translationFileOpen() {
    const actions = document.getElementById("topActions");
    return Boolean(actions && getComputedStyle(actions).display !== "none");
  }

  function englishReferenceLoaded() {
    const button = document.getElementById("btnEnRef");
    return Boolean(button?.textContent?.includes("✓"));
  }

  function applyReferenceReminder() {
    const button = document.getElementById("btnEnRef");
    if (!button) return;
    const needed = Boolean(state.referenceReminder && translationFileOpen() && !englishReferenceLoaded());
    button.classList.toggle("settings-reference-needed", needed);
    button.setAttribute("data-reference-reminder", needed ? "true" : "false");
  }

  function render() {
    if (!ui.dialog) return;
    ui.open.title = t("button");
    ui.open.setAttribute("aria-label", t("button"));
    ui.title.textContent = t("title");
    ui.intro.textContent = t("intro");
    ui.referenceLabel.textContent = t("referenceReminder");
    ui.referenceHint.textContent = t("referenceReminderHint");
    ui.reference.checked = Boolean(state.referenceReminder);
    ui.close.textContent = t("close");
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `.settings-open{width:38px;height:38px;padding:0;font-size:18px;line-height:1}.settings-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;z-index:1100;padding:24px}.settings-backdrop.open{display:flex}.settings-dialog{width:min(560px,100%);background:var(--panel,#171a20);border:1px solid var(--line,#343944);border-radius:14px;padding:20px;box-shadow:0 22px 70px rgba(0,0,0,.45)}.settings-head{display:flex;gap:16px;align-items:flex-start}.settings-head h2{margin:0 0 6px}.settings-head p{margin:0;color:var(--muted,#9aa3b2)}.settings-grow{flex:1}.settings-close{font-size:18px;line-height:1;padding:6px 9px}.settings-list{display:grid;gap:10px;margin-top:20px}.settings-row{display:flex;gap:14px;align-items:flex-start;padding:14px;border:1px solid var(--line,#343944);border-radius:10px}.settings-row input{margin-top:3px;accent-color:var(--accent,#7aa2f7)}.settings-copy{display:grid;gap:4px}.settings-copy strong{font-size:14px}.settings-copy span{font-size:12px;color:var(--muted,#9aa3b2);line-height:1.45}.settings-reference-needed{animation:settings-reference-pulse 1.8s ease-in-out infinite;border-color:color-mix(in srgb,var(--warn,#d9a441) 72%,var(--line,#343944))!important}@keyframes settings-reference-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--warn,#d9a441) 0%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--warn,#d9a441) 24%,transparent)}}@media(prefers-reduced-motion:reduce){.settings-reference-needed{animation:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--warn,#d9a441) 22%,transparent)}}`;
    document.head.append(style);
  }

  function buildUi() {
    injectStyles();

    ui.open = document.createElement("button");
    ui.open.type = "button";
    ui.open.className = "btn ghost settings-open";
    ui.open.textContent = "⚙";
    document.getElementById("uiLang")?.insertAdjacentElement("afterend", ui.open);

    ui.backdrop = document.createElement("div");
    ui.backdrop.className = "settings-backdrop";
    ui.dialog = document.createElement("section");
    ui.dialog.className = "settings-dialog";
    ui.dialog.setAttribute("role", "dialog");
    ui.dialog.setAttribute("aria-modal", "true");

    const head = document.createElement("div");
    head.className = "settings-head";
    const heading = document.createElement("div");
    ui.title = document.createElement("h2");
    ui.intro = document.createElement("p");
    heading.append(ui.title, ui.intro);
    const grow = document.createElement("div");
    grow.className = "settings-grow";
    ui.close = document.createElement("button");
    ui.close.type = "button";
    ui.close.className = "settings-close";
    head.append(heading, grow, ui.close);

    const list = document.createElement("div");
    list.className = "settings-list";
    const row = document.createElement("label");
    row.className = "settings-row";
    ui.reference = document.createElement("input");
    ui.reference.type = "checkbox";
    const copy = document.createElement("span");
    copy.className = "settings-copy";
    ui.referenceLabel = document.createElement("strong");
    ui.referenceHint = document.createElement("span");
    copy.append(ui.referenceLabel, ui.referenceHint);
    row.append(ui.reference, copy);
    list.append(row);

    ui.dialog.append(head, list);
    ui.backdrop.append(ui.dialog);
    document.body.append(ui.backdrop);

    ui.open.addEventListener("click", () => {
      render();
      ui.backdrop.classList.add("open");
      ui.reference.focus();
    });
    ui.close.addEventListener("click", () => ui.backdrop.classList.remove("open"));
    ui.backdrop.addEventListener("click", event => {
      if (event.target === ui.backdrop) ui.backdrop.classList.remove("open");
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && ui.backdrop.classList.contains("open")) ui.backdrop.classList.remove("open");
    });
    ui.reference.addEventListener("change", () => {
      state.referenceReminder = ui.reference.checked;
      persist();
    });
    document.getElementById("uiLang")?.addEventListener("change", render);

    const watched = [document.getElementById("topActions"), document.getElementById("btnEnRef")].filter(Boolean);
    observer = new MutationObserver(applyReferenceReminder);
    watched.forEach(node => observer.observe(node, { attributes: true, childList: true, subtree: true, characterData: true }));

    render();
    applyReferenceReminder();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildUi);
  else buildUi();

  globalThis.NecesseSettings = Object.freeze({
    get: () => ({ ...state }),
    set(name, value) {
      if (!(name in defaults)) throw new TypeError(`Unknown setting: ${name}`);
      state[name] = Boolean(value);
      persist();
      render();
    }
  });
})();
