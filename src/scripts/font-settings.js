"use strict";

(function initializeFontSettings() {
  const STORAGE_KEY = "necesse-translator.font-settings.v1";
  const SAFE_FALLBACK = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans CJK SC', 'Noto Sans Arabic', sans-serif";
  const EDITOR_FALLBACK = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans CJK SC', 'Noto Sans Arabic', sans-serif";
  const PRESETS = Object.freeze({
    default: "",
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Noto Serif', 'Noto Serif CJK SC', serif",
    mono: "ui-monospace, 'Cascadia Code', 'JetBrains Mono', 'Noto Sans Mono', Consolas, monospace"
  });
  const defaults = Object.freeze({
    interfacePreset: "default",
    interfaceCustom: "",
    editorPreset: "default",
    editorCustom: ""
  });
  const state = { ...defaults, ...restore() };
  const ui = {};

  const fallbackText = Object.freeze({
    title: "Fonts",
    hint: "Choose separate fonts for the interface and translation editor. Only the font-family preference is stored.",
    interface: "Interface font",
    editor: "Editor font",
    custom: "Custom local font name",
    preview: "Preview: Български · English · Русский · العربية · 日本語 · 한국어 · 中文",
    default: "Default",
    system: "System sans-serif",
    serif: "Serif",
    mono: "Monospace"
  });

  const t = key => {
    const full = `settings.font.${key}`;
    const translated = globalThis.NecesseI18n?.t(full);
    return translated && translated !== full ? translated : fallbackText[key];
  };

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
  }

  function sanitizeFamily(value) {
    return String(value || "")
      .replace(/[\u0000-\u001f\u007f{};]/g, "")
      .replace(/[\r\n\t]+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function quoteFamily(value) {
    const clean = sanitizeFamily(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return clean ? `'${clean}'` : "";
  }

  function stack(preset, custom, fallback) {
    if (preset === "custom") {
      const family = quoteFamily(custom);
      return family ? `${family}, ${fallback}` : fallback;
    }
    return PRESETS[preset] || fallback;
  }

  function apply() {
    const root = document.documentElement;
    const interfaceStack = stack(state.interfacePreset, state.interfaceCustom, SAFE_FALLBACK);
    const editorStack = stack(state.editorPreset, state.editorCustom, EDITOR_FALLBACK);
    root.style.setProperty("--user-interface-font", interfaceStack);
    root.style.setProperty("--user-editor-font", editorStack);
    root.style.setProperty("--sans", interfaceStack);
    updatePreview();
  }

  function option(value, label) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  }

  function makeControl(kind) {
    const row = document.createElement("div");
    row.className = "settings-row font-settings-row";
    const copy = document.createElement("span");
    copy.className = "settings-copy";
    const label = document.createElement("strong");
    label.textContent = t(kind);
    const hint = document.createElement("span");
    hint.textContent = t("hint");
    copy.append(label, hint);

    const controls = document.createElement("span");
    controls.className = "font-settings-controls";
    const select = document.createElement("select");
    select.append(
      option("default", t("default")),
      option("system", t("system")),
      option("serif", t("serif")),
      option("mono", t("mono")),
      option("custom", t("custom"))
    );
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = t("custom");
    input.maxLength = 120;
    input.spellcheck = false;

    const presetKey = `${kind}Preset`;
    const customKey = `${kind}Custom`;
    select.value = state[presetKey] in PRESETS || state[presetKey] === "custom" ? state[presetKey] : "default";
    input.value = sanitizeFamily(state[customKey]);

    const sync = () => {
      input.hidden = select.value !== "custom";
      state[presetKey] = select.value;
      state[customKey] = sanitizeFamily(input.value);
      persist();
      apply();
    };
    select.addEventListener("change", sync);
    input.addEventListener("input", sync);
    input.hidden = select.value !== "custom";
    controls.append(select, input);
    row.append(copy, controls);
    return { row, label, hint, select, input };
  }

  function updatePreview() {
    if (!ui.preview) return;
    ui.preview.textContent = t("preview");
    ui.preview.style.fontFamily = "var(--user-editor-font)";
  }

  function render() {
    if (!ui.section) return;
    ui.title.textContent = t("title");
    for (const kind of ["interface", "editor"]) {
      const control = ui[kind];
      control.label.textContent = t(kind);
      control.hint.textContent = t("hint");
      const values = ["default", "system", "serif", "mono", "custom"];
      [...control.select.options].forEach((item, index) => { item.textContent = t(values[index]); });
      control.input.placeholder = t("custom");
    }
    updatePreview();
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `body,button,input,select{font-family:var(--user-interface-font,var(--sans))}.orig,.ren,.rtr,.difftext,.tawrap>textarea,.tawrap>.wsback{font-family:var(--user-editor-font,var(--sans))}.font-settings-section{display:grid;gap:10px;margin-top:12px}.font-settings-section h3{margin:8px 2px 0;font-size:14px}.font-settings-row{align-items:center}.font-settings-controls{display:grid;gap:8px;min-width:240px;margin-left:auto}.font-settings-controls select,.font-settings-controls input{width:100%;padding:8px 10px;border:1px solid var(--line,#343944);border-radius:8px;background:var(--bg,#101217);color:inherit}.font-settings-preview{padding:12px 14px;border:1px dashed var(--line,#343944);border-radius:10px;line-height:1.6;unicode-bidi:plaintext}@media(max-width:620px){.font-settings-row{display:grid}.font-settings-controls{min-width:0;width:100%;margin-left:0}}`;
    document.head.append(style);
  }

  function initialize() {
    injectStyles();
    apply();
    const list = document.querySelector(".settings-list");
    if (!list) return;
    ui.section = document.createElement("section");
    ui.section.className = "font-settings-section";
    ui.title = document.createElement("h3");
    ui.interface = makeControl("interface");
    ui.editor = makeControl("editor");
    ui.preview = document.createElement("div");
    ui.preview.className = "font-settings-preview";
    ui.section.append(ui.title, ui.interface.row, ui.editor.row, ui.preview);
    list.append(ui.section);
    document.getElementById("uiLang")?.addEventListener("change", render);
    document.querySelector(".settings-open")?.addEventListener("click", render);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();

  globalThis.NecesseFontSettings = Object.freeze({
    get: () => ({ ...state }),
    apply,
    sanitizeFamily
  });
})();
