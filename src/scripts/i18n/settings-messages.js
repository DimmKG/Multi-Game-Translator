"use strict";

(function registerSettingsMessages() {
  const messages = {
    en: {
      "settings.button": "Settings",
      "settings.title": "Settings",
      "settings.intro": "Choose how the editor draws attention to optional tools and reminders.",
      "settings.referenceReminder": "Highlight missing en.lang reference",
      "settings.referenceReminderHint": "Pulse the en.lang button after a translation file is opened until an English reference is loaded.",
      "settings.close": "Close"
    },
    ru: {
      "settings.button": "Настройки",
      "settings.title": "Настройки",
      "settings.intro": "Выберите, как редактор должен привлекать внимание к дополнительным инструментам и напоминаниям.",
      "settings.referenceReminder": "Подсвечивать отсутствие en.lang",
      "settings.referenceReminderHint": "Пульсировать кнопкой en.lang после открытия файла перевода, пока английский файл-источник не загружен.",
      "settings.close": "Закрыть"
    },
    bg: {
      "settings.button": "Настройки",
      "settings.title": "Настройки",
      "settings.intro": "Изберете как редакторът да насочва вниманието към допълнителни инструменти и напомняния.",
      "settings.referenceReminder": "Подчертаване на липсваща en.lang референция",
      "settings.referenceReminderHint": "Бутонът за en.lang пулсира след отваряне на преводен файл, докато не бъде заредена английската референция.",
      "settings.close": "Затваряне"
    }
  };

  for (const [code, locale] of Object.entries(messages)) {
    if (globalThis.I18N?.[code]) Object.assign(globalThis.I18N[code], locale);
  }
  globalThis.NecesseSettingsMessages = Object.freeze(messages);
})();
