"use strict";

const LOCALE_FORMAT = "necesse-interface-locale";
const LOCALE_VERSION = 1;
const STORAGE_KEY = "necesse-translator.interface-locales.v1";
const BUILTIN_CODES = new Set(["en", "bg", "ru"]);
const CODE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

const TEXT = {
  en: {
    button: "Interface languages", title: "Interface languages",
    intro: "Import partial or complete interface translations. Missing messages use English.",
    import: "Import locale", export: "Export English template", installed: "Installed locales",
    empty: "No additional interface languages installed.", remove: "Remove", close: "Close",
    loaded: name => `Interface language “${name}” was installed.`,
    replaced: name => `Interface language “${name}” was updated.`,
    removed: name => `Interface language “${name}” was removed.`,
    error: "Could not load interface locale: ", messages: n => `${n} translated messages`
  },
  ru: {
    button: "Языки интерфейса", title: "Языки интерфейса",
    intro: "Импортируйте полный или частичный перевод интерфейса. Пропущенные сообщения используются из английского.",
    import: "Импорт локали", export: "Экспорт английского шаблона", installed: "Установленные локали",
    empty: "Дополнительные языки интерфейса не установлены.", remove: "Удалить", close: "Закрыть",
    loaded: name => `Язык интерфейса «${name}» установлен.`,
    replaced: name => `Язык интерфейса «${name}» обновлён.`,
    removed: name => `Язык интерфейса «${name}» удалён.`,
    error: "Не удалось загрузить локаль интерфейса: ", messages: n => `Переведено сообщений: ${n}`
  },
  bg: {
    button: "Езици на интерфейса", title: "Езици на интерфейса",
    intro: "Импортирайте пълен или частичен превод на интерфейса. Липсващите съобщения използват английския текст.",
    import: "Импортиране на локализация", export: "Експортиране на английски шаблон", installed: "Инсталирани локализации",
    empty: "Няма допълнително инсталирани езици на интерфейса.", remove: "Премахване", close: "Затваряне",
    loaded: name => `Езикът „${name}“ беше инсталиран.`,
    replaced: name => `Езикът „${name}“ беше обновен.`,
    removed: name => `Езикът „${name}“ беше премахнат.`,
    error: "Локализацията не може да бъде заредена: ", messages: n => `${n} преведени съобщения`
  }
};

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
}

export function normalizeInterfaceLocale(input) {
  assertObject(input, "Interface locale");
  if (input.format !== LOCALE_FORMAT || input.version !== LOCALE_VERSION) throw new TypeError("Unsupported interface locale format or version.");
  if (typeof input.code !== "string" || !CODE_PATTERN.test(input.code)) throw new TypeError("Interface locale code is invalid.");
  if (BUILTIN_CODES.has(input.code)) throw new TypeError(`Built-in locale “${input.code}” cannot be replaced.`);
  if (typeof input.name !== "string" || !input.name.trim()) throw new TypeError("Interface locale name is required.");
  if (typeof input.nativeName !== "string" || !input.nativeName.trim()) throw new TypeError("Interface locale nativeName is required.");
  assertObject(input.messages, "Interface locale messages");

  const messages = {};
  for (const [key, value] of Object.entries(input.messages)) {
    if (!(key in I18N.en)) throw new TypeError(`Unknown interface message key: ${key}`);
    if (typeof value !== "string") throw new TypeError(`Interface message “${key}” must be a string.`);
    messages[key] = value;
  }
  if (!Object.keys(messages).length) throw new TypeError("Interface locale must contain at least one message.");

  return Object.freeze({
    format: LOCALE_FORMAT,
    version: LOCALE_VERSION,
    code: input.code,
    name: input.name.trim(),
    nativeName: input.nativeName.trim(),
    authors: Object.freeze(Array.isArray(input.authors) ? input.authors.filter(v => typeof v === "string" && v.trim()) : []),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : "",
    messages: Object.freeze(messages)
  });
}

export function applyInterfaceLocale(locale) {
  I18N[locale.code] = Object.freeze({ ...I18N.en, ...locale.messages });
  return I18N[locale.code];
}

const state = { locales: [] };
const ui = {};
const currentUiLanguage = () => document.getElementById("uiLang")?.value || "en";
const t = () => TEXT[currentUiLanguage()] || TEXT.en;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.locales));
}

function optionFor(code) {
  return [...document.getElementById("uiLang")?.options || []].find(option => option.value === code);
}

function install(locale, persist = true) {
  const index = state.locales.findIndex(item => item.code === locale.code);
  if (index >= 0) state.locales.splice(index, 1, locale); else state.locales.push(locale);
  applyInterfaceLocale(locale);
  const select = document.getElementById("uiLang");
  let option = optionFor(locale.code);
  if (!option && select) {
    option = document.createElement("option");
    option.value = locale.code;
    select.append(option);
  }
  if (option) option.textContent = locale.nativeName;
  if (persist) save();
  render();
  return index >= 0;
}

function remove(code) {
  const locale = state.locales.find(item => item.code === code);
  state.locales = state.locales.filter(item => item.code !== code);
  delete I18N[code];
  optionFor(code)?.remove();
  if (currentUiLanguage() === code) document.getElementById("uiLang").value = "en";
  save();
  document.getElementById("uiLang")?.dispatchEvent(new Event("change"));
  status(t().removed(locale?.nativeName || code));
  render();
}

function restore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      try { install(normalizeInterfaceLocale(item), false); } catch { /* Ignore stale invalid packages. */ }
    }
  } catch { state.locales = []; }
}

function status(message, error = false) {
  if (!ui.status) return;
  ui.status.textContent = message;
  ui.status.dataset.error = error ? "true" : "false";
}

function render() {
  if (!ui.dialog) return;
  const text = t();
  ui.open.textContent = text.button; ui.title.textContent = text.title; ui.intro.textContent = text.intro;
  ui.import.textContent = text.import; ui.export.textContent = text.export; ui.heading.textContent = text.installed; ui.close.textContent = text.close;
  ui.list.replaceChildren();
  if (!state.locales.length) {
    const empty = document.createElement("p"); empty.className = "lp-note"; empty.textContent = text.empty; ui.list.append(empty);
  }
  for (const locale of state.locales) {
    const row = document.createElement("div"); row.className = "lp-row";
    const info = document.createElement("div"); info.className = "lp-info";
    const strong = document.createElement("strong"); strong.textContent = `${locale.nativeName} (${locale.code})`;
    const meta = document.createElement("span"); meta.textContent = [text.messages(Object.keys(locale.messages).length), locale.updatedAt].filter(Boolean).join(" · ");
    info.append(strong, meta);
    const removeButton = document.createElement("button"); removeButton.textContent = text.remove; removeButton.addEventListener("click", () => remove(locale.code));
    row.append(info, removeButton); ui.list.append(row);
  }
}

function downloadTemplate() {
  const locale = {
    $schema: "../../schemas/interface-locale-v1.schema.json",
    format: LOCALE_FORMAT, version: LOCALE_VERSION,
    code: "xx", name: "Example language", nativeName: "Example language",
    authors: [], updatedAt: new Date().toISOString().slice(0, 10), messages: { ...I18N.en }
  };
  const blob = new Blob([JSON.stringify(locale, null, 2) + "\n"], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "interface-locale-template.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function build() {
  const select = document.getElementById("uiLang");
  ui.open = document.createElement("button"); ui.open.className = "btn ghost lp-open"; select?.insertAdjacentElement("afterend", ui.open);
  ui.backdrop = document.createElement("div"); ui.backdrop.className = "lp-backdrop";
  ui.dialog = document.createElement("section"); ui.dialog.className = "lp-dialog"; ui.dialog.setAttribute("role", "dialog"); ui.dialog.setAttribute("aria-modal", "true");
  const head = document.createElement("div"); head.className = "lp-head"; const copy = document.createElement("div");
  ui.title = document.createElement("h2"); ui.intro = document.createElement("p"); copy.append(ui.title, ui.intro);
  ui.close = document.createElement("button"); ui.close.className = "lp-close"; head.append(copy, ui.close);
  const actions = document.createElement("div"); actions.className = "lp-actions";
  ui.import = document.createElement("button"); ui.import.className = "btn primary"; ui.export = document.createElement("button"); ui.export.className = "btn ghost";
  ui.file = document.createElement("input"); ui.file.type = "file"; ui.file.accept = ".json,application/json"; ui.file.hidden = true; actions.append(ui.import, ui.export, ui.file);
  ui.heading = document.createElement("h3"); ui.list = document.createElement("div"); ui.list.className = "lp-list"; ui.status = document.createElement("div"); ui.status.className = "lp-status";
  ui.dialog.append(head, actions, ui.heading, ui.list, ui.status); ui.backdrop.append(ui.dialog); document.body.append(ui.backdrop);
  ui.open.addEventListener("click", () => { ui.backdrop.classList.add("open"); render(); });
  ui.close.addEventListener("click", () => ui.backdrop.classList.remove("open"));
  ui.backdrop.addEventListener("click", event => { if (event.target === ui.backdrop) ui.backdrop.classList.remove("open"); });
  ui.import.addEventListener("click", () => ui.file.click()); ui.export.addEventListener("click", downloadTemplate);
  ui.file.addEventListener("change", async () => {
    const file = ui.file.files?.[0]; if (!file) return;
    try {
      const locale = normalizeInterfaceLocale(JSON.parse((await file.text()).replace(/^\uFEFF/, "")));
      const replaced = install(locale);
      status((replaced ? t().replaced : t().loaded)(locale.nativeName));
    } catch (error) { status(t().error + error.message, true); }
    finally { ui.file.value = ""; }
  });
  select?.addEventListener("change", render);
  render();
}

function styles() {
  const style = document.createElement("style");
  style.textContent = `.lp-open{margin-left:8px}.lp-backdrop{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.62);z-index:1100}.lp-backdrop.open{display:flex}.lp-dialog{width:min(680px,100%);max-height:86vh;overflow:auto;background:var(--panel,#171a20);border:1px solid var(--line,#343944);border-radius:14px;padding:20px}.lp-head{display:flex;justify-content:space-between;gap:18px}.lp-head h2{margin:0 0 6px}.lp-head p,.lp-note,.lp-info span{color:var(--muted,#9aa3b2);font-size:12px}.lp-close{font-size:18px}.lp-actions{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.lp-dialog h3{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#9aa3b2)}.lp-list{display:grid;gap:8px}.lp-row{display:flex;align-items:center;gap:12px;padding:11px;border:1px solid var(--line,#343944);border-radius:9px}.lp-info{display:grid;gap:4px;flex:1}.lp-status{min-height:20px;margin-top:12px;font-size:12px}.lp-status[data-error=true]{color:#ff7f7f}`;
  document.head.append(style);
}

restore();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { styles(); build(); });
else { styles(); build(); }
