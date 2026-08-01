"use strict";

(function initializeMtSecretVaultUi() {
  const ui = {};
  const t = key => globalThis.NecesseI18n?.t(key) || key;

  function secretCount() {
    return globalThis.NecesseMtProviderSettings?.secretCount?.() || 0;
  }

  function update() {
    if (!ui.section) return;
    const count = secretCount();
    ui.status.textContent = count
      ? t("settings.secretVaultUnlocked").replace("{n}", count)
      : t("settings.secretVaultEmpty");
    ui.export.disabled = count === 0;
    ui.clear.disabled = count === 0;
  }

  function askPassphrase(confirmValue) {
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.className = "settings-vault-dialog";
      const form = document.createElement("form");
      form.method = "dialog";
      const title = document.createElement("h3");
      title.textContent = confirmValue ? t("settings.secretVaultCreatePassword") : t("settings.secretVaultEnterPassword");
      const password = document.createElement("input");
      password.type = "password";
      password.autocomplete = "new-password";
      password.required = true;
      password.placeholder = t("settings.secretVaultPassword");
      const confirmation = document.createElement("input");
      confirmation.type = "password";
      confirmation.autocomplete = "new-password";
      confirmation.required = confirmValue;
      confirmation.placeholder = t("settings.secretVaultConfirmPassword");
      if (!confirmValue) confirmation.hidden = true;
      const error = document.createElement("p");
      error.className = "settings-vault-error";
      const actions = document.createElement("div");
      actions.className = "settings-vault-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = t("settings.secretVaultCancel");
      const accept = document.createElement("button");
      accept.type = "submit";
      accept.className = "btn primary";
      accept.textContent = t("settings.secretVaultContinue");
      actions.append(cancel, accept);
      form.append(title, password, confirmation, error, actions);
      dialog.append(form);
      document.body.append(dialog);

      function finish(value) {
        dialog.close();
        dialog.remove();
        resolve(value);
      }

      cancel.addEventListener("click", () => finish(""));
      dialog.addEventListener("cancel", event => {
        event.preventDefault();
        finish("");
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        if (!password.value) return;
        if (confirmValue && password.value !== confirmation.value) {
          error.textContent = t("settings.secretVaultPasswordMismatch");
          confirmation.focus();
          return;
        }
        finish(password.value);
      });
      dialog.showModal();
      password.focus();
    });
  }

  function download(text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `necesse-provider-secrets-${date}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function exportVault() {
    const store = globalThis.NecesseMtProviderSettings;
    const vault = globalThis.NecesseMtSecretVault;
    if (!store || !vault || !secretCount()) return;
    const passphrase = await askPassphrase(true);
    if (!passphrase) return;
    try {
      download(await vault.encrypt(store.exportSecrets(), passphrase));
    } catch (error) {
      alert(t("settings.secretVaultExportError") + " " + (error?.message || error));
    }
  }

  async function importVault(file) {
    const store = globalThis.NecesseMtProviderSettings;
    const vault = globalThis.NecesseMtSecretVault;
    if (!file || !store || !vault) return;
    const passphrase = await askPassphrase(false);
    if (!passphrase) return;
    try {
      const secrets = await vault.decrypt(await file.text(), passphrase);
      store.importSecrets(secrets, { replace: true });
      globalThis.NecesseMtProviderSettingsUi?.render?.();
      update();
    } catch (error) {
      alert(t("settings.secretVaultImportError") + " " + (error?.message || error));
    }
  }

  function build() {
    const list = document.querySelector(".settings-list");
    if (!list || ui.section) return;
    const section = document.createElement("section");
    section.className = "settings-provider-section settings-vault-section";
    const title = document.createElement("h3");
    title.className = "settings-provider-title";
    title.textContent = t("settings.secretVaultTitle");
    const hint = document.createElement("p");
    hint.className = "settings-vault-hint";
    hint.textContent = t("settings.secretVaultHint");
    ui.status = document.createElement("p");
    ui.status.className = "settings-vault-status";
    const actions = document.createElement("div");
    actions.className = "settings-vault-actions";
    ui.export = document.createElement("button");
    ui.export.type = "button";
    ui.export.textContent = t("settings.secretVaultExport");
    ui.import = document.createElement("button");
    ui.import.type = "button";
    ui.import.textContent = t("settings.secretVaultImport");
    ui.clear = document.createElement("button");
    ui.clear.type = "button";
    ui.clear.textContent = t("settings.secretVaultClear");
    ui.file = document.createElement("input");
    ui.file.type = "file";
    ui.file.accept = ".json,application/json";
    ui.file.hidden = true;
    actions.append(ui.export, ui.import, ui.clear);
    section.append(title, hint, ui.status, actions, ui.file);
    list.append(section);
    ui.section = section;

    ui.export.addEventListener("click", exportVault);
    ui.import.addEventListener("click", () => ui.file.click());
    ui.file.addEventListener("change", async () => {
      const [file] = ui.file.files || [];
      ui.file.value = "";
      await importVault(file);
    });
    ui.clear.addEventListener("click", () => {
      globalThis.NecesseMtProviderSettings?.clearSecrets?.();
      globalThis.NecesseMtProviderSettingsUi?.render?.();
      update();
    });
    update();
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `.settings-vault-hint,.settings-vault-status{margin:0;color:var(--muted,#9aa3b2);font-size:12px;line-height:1.45}.settings-vault-actions{display:flex;gap:8px;flex-wrap:wrap}.settings-vault-dialog{width:min(460px,calc(100% - 32px));padding:20px;border:1px solid var(--line,#343944);border-radius:12px;background:var(--panel,#171a20);color:inherit}.settings-vault-dialog::backdrop{background:rgba(0,0,0,.72)}.settings-vault-dialog form{display:grid;gap:12px}.settings-vault-dialog h3{margin:0}.settings-vault-dialog input{padding:10px;border:1px solid var(--line,#343944);border-radius:8px;background:var(--bg,#101217);color:inherit}.settings-vault-error{min-height:1.2em;margin:0;color:var(--warn,#d9a441);font-size:12px}`;
    document.head.append(style);
  }

  function renderText() {
    if (!ui.section) return;
    ui.section.querySelector(".settings-provider-title").textContent = t("settings.secretVaultTitle");
    ui.section.querySelector(".settings-vault-hint").textContent = t("settings.secretVaultHint");
    ui.export.textContent = t("settings.secretVaultExport");
    ui.import.textContent = t("settings.secretVaultImport");
    ui.clear.textContent = t("settings.secretVaultClear");
    update();
  }

  function initialize() {
    injectStyles();
    build();
    globalThis.addEventListener?.("necesse:mt-secrets-changed", update);
    document.getElementById("uiLang")?.addEventListener("change", renderText);
    document.querySelector(".settings-open")?.addEventListener("click", () => {
      build();
      renderText();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();

  globalThis.NecesseMtSecretVaultUi = Object.freeze({ update });
})();
