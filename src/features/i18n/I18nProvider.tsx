// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getAllLocales, translateMessage } from "./locale-registry";

const UI_LANG_KEY = "necesse_lang_translator_ui_lang";
const RTL_CODES = new Set(["ar"]);

interface I18nContextValue {
  language: string;
  setLanguage: (code: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locales: ReturnType<typeof getAllLocales>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLanguage() {
  try {
    const saved = localStorage.getItem(UI_LANG_KEY);
    if (saved && getAllLocales().some((locale) => locale.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  const navigatorLanguage = (navigator.language || "en").toLowerCase();
  if (navigatorLanguage.startsWith("bg")) return "bg";
  if (navigatorLanguage.startsWith("ru")) return "ru";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(detectLanguage);
  const locales = useMemo(() => getAllLocales(), []);

  const setLanguage = useCallback(
    (code: string) => {
      if (!locales.some((locale) => locale.code === code)) return;
      setLanguageState(code);
      try {
        localStorage.setItem(UI_LANG_KEY, code);
      } catch {
        /* ignore */
      }
    },
    [locales],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translateMessage(language, key, vars),
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_CODES.has(language) ? "rtl" : "ltr";
    document.title = translateMessage(language, "app.title");
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t, locales }),
    [language, setLanguage, t, locales],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
