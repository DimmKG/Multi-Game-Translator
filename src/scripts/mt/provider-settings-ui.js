"use strict";

(function initializeMtProviderSettingsUi() {
  const ui = { sections: new Map() };

  const t = key => globalThis.NecesseI18n?.t(key) || key;

  function fieldLabel(field) {
    return field.labelKey ? t(field.labelKey) : field.id;
  }

  function fieldHint(field) {
    return field.hintKey ? t(field.hintKey) : "";
  }

  function buildField(providerId, field) {
    const row = document.createElement("label");
    row.className = "settings-row settings-provider-row";

    const copy = document.createElement("span");
    copy.className = "settings-copy";
    const label = document.createElement("strong");
    const hint = document.createElement("span");
    label.textContent = fieldLabel(field);
    hint.textContent = fieldHint(field);
    copy.append(label, hint);

    const input = document.createElement("input");
    input.className = "settings-provider-input";
    input.type = field.type === "secret" ? "password" : "text";
    input.autocomplete = field.type === "secret" ? "off" : "on";
    input.spellcheck = false;
    input.required = field.required;
    input.placeholder = field.placeholder;
    input.dataset.provider = providerId;
    input.dataset.field = field.id;
    input.dataset.secret = field.type === "secret" ? "true" : "false";

    const store = globalThis.NecesseMtProviderSettings;
    const resolved = store?.resolve(providerId) || {};
    input.value = resolved[field.id] || "";
    input.addEventListener("change", () => {
      if (field.type === "secret") store?.setSecret(providerId, field.id, input.value);
      else store?.setPublic(providerId, field.id, input.value);
    });

    row.append(copy, input);
    return row;
  }

  function render() {
    const list = document.querySelector(".settings-list");
    const providers = globalThis.NecesseMtProviders?.getAll?.() || [];
    const store = globalThis.NecesseMtProviderSettings;
    if (!list || !store) return;

    for (const section of ui.sections.values()) section.remove();
    ui.sections.clear();

    for (const provider of providers) {
      const schema = store.schema(provider.id);
      if (!schema.length) continue;

      const section = document.createElement("section");
      section.className = "settings-provider-section";
      section.dataset.provider = provider.id;

      const title = document.createElement("h3");
      title.className = "settings-provider-title";
      title.textContent = provider.name;
      section.append(title);

      for (const field of schema) section.append(buildField(provider.id, field));
      list.append(section);
      ui.sections.set(provider.id, section);
    }
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `.settings-provider-section{display:grid;gap:10px;margin-top:10px}.settings-provider-title{margin:10px 2px 0;font-size:14px}.settings-provider-row{align-items:center}.settings-provider-input{min-width:220px;max-width:52%;margin-left:auto;padding:8px 10px;border:1px solid var(--line,#343944);border-radius:8px;background:var(--bg,#101217);color:inherit}.settings-provider-input[data-secret="true"]{font-family:monospace}`;
    document.head.append(style);
  }

  function initialize() {
    injectStyles();
    render();
    globalThis.addEventListener?.("necesse:mt-provider-registered", render);
    document.getElementById("uiLang")?.addEventListener("change", render);
    document.querySelector(".settings-open")?.addEventListener("click", render);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();

  globalThis.NecesseMtProviderSettingsUi = Object.freeze({ render });
})();
