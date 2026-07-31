"use strict";

(function initializeSharedInterfaceI18n() {
  const extensions = {
    en: {
      "glossary.button": "Glossaries",
      "glossary.title": "Glossary Manager",
      "glossary.intro": "Import local terminology files or load available online glossaries.",
      "glossary.import": "Import glossary",
      "glossary.catalog": "Load online catalog",
      "glossary.online": "Online catalog",
      "glossary.local": "Loaded glossaries",
      "glossary.offline": "Online catalogs are unavailable in direct-file mode. Local glossary import remains available.",
      "glossary.empty": "No glossaries loaded.",
      "glossary.remove": "Remove",
      "glossary.entries": "entries",
      "glossary.enabled": "Enabled",
      "glossary.disabled": "Disabled",
      "glossary.loaded": "Glossary loaded.",
      "glossary.replaced": "Existing glossary replaced.",
      "glossary.removed": "Glossary removed.",
      "glossary.close": "Close",
      "glossary.catalogEmpty": "The catalog contains no glossaries.",
      "glossary.install": "Load",
      "glossary.loading": "Loading…",
      "glossary.error": "Could not load glossary: ",
      "terminology.title": "Terminology",
      "terminology.forbidden": "Avoid “{found}”. Preferred term: “{preferred}”.",
      "terminology.missing": "The source contains “{source}”. Expected: “{preferred}”.",
      "terminology.glossary": "Glossary: {name}",
      "terminology.count.one": "{n} terminology issue",
      "terminology.count.other": "{n} terminology issues",
      "terminology.filter": "Terminology",
      "terminology.filterTitle": "Show only translations with terminology issues",
      "terminology.next": "Next terminology issue",
      "terminology.none": "No terminology issues found.",
      "terminology.reviewBadge": "Terminology: {n}",
      "interfaceLocales.button": "Interface languages",
      "interfaceLocales.title": "Interface languages",
      "interfaceLocales.intro": "Import partial or complete interface translations. Missing messages use English.",
      "interfaceLocales.import": "Import locale",
      "interfaceLocales.export": "Export English template",
      "interfaceLocales.installed": "Installed locales",
      "interfaceLocales.empty": "No additional interface languages installed.",
      "interfaceLocales.remove": "Remove",
      "interfaceLocales.close": "Close",
      "interfaceLocales.loaded": "Interface language “{name}” was installed.",
      "interfaceLocales.replaced": "Interface language “{name}” was updated.",
      "interfaceLocales.removed": "Interface language “{name}” was removed.",
      "interfaceLocales.error": "Could not load interface locale: ",
      "interfaceLocales.messages": "{n} translated messages"
    },
    ru: {
      "glossary.button": "Глоссарии",
      "glossary.title": "Менеджер глоссариев",
      "glossary.intro": "Импортируйте локальные файлы терминологии или загрузите доступные онлайн-глоссарии.",
      "glossary.import": "Импорт глоссария",
      "glossary.catalog": "Загрузить онлайн-каталог",
      "glossary.online": "Онлайн-каталог",
      "glossary.local": "Загруженные глоссарии",
      "glossary.offline": "Онлайн-каталоги недоступны при прямом открытии файла. Локальный импорт продолжает работать.",
      "glossary.empty": "Глоссарии не загружены.",
      "glossary.remove": "Удалить",
      "glossary.entries": "записей",
      "glossary.enabled": "Включён",
      "glossary.disabled": "Выключен",
      "glossary.loaded": "Глоссарий загружен.",
      "glossary.replaced": "Существующий глоссарий заменён.",
      "glossary.removed": "Глоссарий удалён.",
      "glossary.close": "Закрыть",
      "glossary.catalogEmpty": "Каталог не содержит глоссариев.",
      "glossary.install": "Загрузить",
      "glossary.loading": "Загрузка…",
      "glossary.error": "Не удалось загрузить глоссарий: ",
      "terminology.title": "Терминология",
      "terminology.forbidden": "Не используйте «{found}». Предпочтительный термин: «{preferred}».",
      "terminology.missing": "Оригинал содержит «{source}». Ожидается: «{preferred}».",
      "terminology.glossary": "Глоссарий: {name}",
      "terminology.count.one": "Проблем с терминологией: {n}",
      "terminology.count.other": "Проблем с терминологией: {n}",
      "terminology.filter": "Терминология",
      "terminology.filterTitle": "Показывать только переводы с терминологическими проблемами",
      "terminology.next": "Следующая терминологическая проблема",
      "terminology.none": "Терминологических проблем не найдено.",
      "terminology.reviewBadge": "Терминология: {n}",
      "interfaceLocales.button": "Языки интерфейса",
      "interfaceLocales.title": "Языки интерфейса",
      "interfaceLocales.intro": "Импортируйте полный или частичный перевод интерфейса. Пропущенные сообщения используются из английского.",
      "interfaceLocales.import": "Импорт локали",
      "interfaceLocales.export": "Экспорт английского шаблона",
      "interfaceLocales.installed": "Установленные локали",
      "interfaceLocales.empty": "Дополнительные языки интерфейса не установлены.",
      "interfaceLocales.remove": "Удалить",
      "interfaceLocales.close": "Закрыть",
      "interfaceLocales.loaded": "Язык интерфейса «{name}» установлен.",
      "interfaceLocales.replaced": "Язык интерфейса «{name}» обновлён.",
      "interfaceLocales.removed": "Язык интерфейса «{name}» удалён.",
      "interfaceLocales.error": "Не удалось загрузить локаль интерфейса: ",
      "interfaceLocales.messages": "Переведено сообщений: {n}"
    },
    bg: {
      "glossary.button": "Речници",
      "glossary.title": "Управление на речници",
      "glossary.intro": "Импортирайте локални терминологични файлове или заредете наличните онлайн речници.",
      "glossary.import": "Импортиране на речник",
      "glossary.catalog": "Зареждане на онлайн каталог",
      "glossary.online": "Онлайн каталог",
      "glossary.local": "Заредени речници",
      "glossary.offline": "Онлайн каталозите не са налични при директно отваряне на файла. Локалният импорт продължава да работи.",
      "glossary.empty": "Няма заредени речници.",
      "glossary.remove": "Премахване",
      "glossary.entries": "термина",
      "glossary.enabled": "Включен",
      "glossary.disabled": "Изключен",
      "glossary.loaded": "Речникът е зареден.",
      "glossary.replaced": "Съществуващият речник е заменен.",
      "glossary.removed": "Речникът е премахнат.",
      "glossary.close": "Затваряне",
      "glossary.catalogEmpty": "Каталогът не съдържа речници.",
      "glossary.install": "Зареждане",
      "glossary.loading": "Зареждане…",
      "glossary.error": "Речникът не може да бъде зареден: ",
      "terminology.title": "Терминология",
      "terminology.forbidden": "Не използвайте „{found}“. Предпочитан термин: „{preferred}“.",
      "terminology.missing": "Оригиналът съдържа „{source}“. Очаквано: „{preferred}“.",
      "terminology.glossary": "Речник: {name}",
      "terminology.count.one": "{n} терминологичен проблем",
      "terminology.count.other": "{n} терминологични проблема",
      "terminology.filter": "Терминология",
      "terminology.filterTitle": "Показване само на преводите с терминологични проблеми",
      "terminology.next": "Следващ терминологичен проблем",
      "terminology.none": "Не са открити терминологични проблеми.",
      "terminology.reviewBadge": "Терминология: {n}",
      "interfaceLocales.button": "Езици на интерфейса",
      "interfaceLocales.title": "Езици на интерфейса",
      "interfaceLocales.intro": "Импортирайте пълен или частичен превод на интерфейса. Липсващите съобщения използват английския текст.",
      "interfaceLocales.import": "Импортиране на локализация",
      "interfaceLocales.export": "Експортиране на английски шаблон",
      "interfaceLocales.installed": "Инсталирани локализации",
      "interfaceLocales.empty": "Няма допълнително инсталирани езици на интерфейса.",
      "interfaceLocales.remove": "Премахване",
      "interfaceLocales.close": "Затваряне",
      "interfaceLocales.loaded": "Езикът „{name}“ беше инсталиран.",
      "interfaceLocales.replaced": "Езикът „{name}“ беше обновен.",
      "interfaceLocales.removed": "Езикът „{name}“ беше премахнат.",
      "interfaceLocales.error": "Локализацията не може да бъде заредена: ",
      "interfaceLocales.messages": "{n} преведени съобщения"
    }
  };

  for (const code of ["en", "ru", "bg"]) Object.assign(I18N[code], extensions[code]);

  const language = () => document.getElementById("uiLang")?.value || "en";
  const translate = (key, vars) => {
    const locale = I18N[language()] || I18N.en;
    let value = locale[key] != null ? locale[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (vars) for (const [name, replacement] of Object.entries(vars)) value = String(value).split(`{${name}}`).join(String(replacement));
    return String(value);
  };
  const plural = (base, count, vars = {}) => translate(`${base}.${count === 1 ? "one" : "other"}`, { ...vars, n: count });
  globalThis.NecesseI18n = Object.freeze({ t: translate, plural });
})();

(function restoreInstalledInterfaceLocales() {
  const storageKey = "necesse-translator.interface-locales.v1";
  try {
    const packages = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(packages)) return;
    const select = document.getElementById("uiLang");
    for (const locale of packages) {
      if (!locale || typeof locale.code !== "string" || !locale.messages || typeof locale.messages !== "object") continue;
      if (["en", "bg", "ru"].includes(locale.code)) continue;
      I18N[locale.code] = Object.freeze({ ...I18N.en, ...locale.messages });
      if (select && ![...select.options].some(option => option.value === locale.code)) {
        const option = document.createElement("option");
        option.value = locale.code;
        option.textContent = locale.nativeName || locale.name || locale.code;
        select.append(option);
      }
    }
  } catch { /* Ignore invalid or unavailable saved locale data. */ }
})();
