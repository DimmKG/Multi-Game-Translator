import { defaultThemes } from "shadcn-theme-switcher/themes";

export const THEME_STORAGE_KEY = "necesse-translator.theme.v1";
export const MODE_STORAGE_KEY = "necesse-translator.theme-mode.v1";

export type ThemeMode = "light" | "dark";

export interface ThemeOption {
  id: string;
  label: string;
  /** Palettes that only exist as a dark design; the mode toggle is a no-op for them. */
  darkOnly?: boolean;
}

/**
 * Curated subset of the shadcn-theme-switcher palettes: the neutral, working
 * ones. Novelty palettes (bubblegum, doom-64, notebook, tangerine, the
 * brand-imitating twitter/t3-chat, mocha-mousse) are deliberately left out —
 * this is a tool people stare at for hours.
 */
const ALLOWED_PALETTES: Record<string, string> = {
  default: "shadcn",
  "modern-minimal": "Modern Minimal",
  graphite: "Graphite",
  mono: "Mono",
  "cosmic-night": "Cosmic Night",
  catppuccin: "Catppuccin",
  perpetuity: "Perpetuity",
  "amethyst-haze": "Amethyst Haze",
};

/** The app's own identity palette is the default, then the curated set. */
export const THEME_OPTIONS: ThemeOption[] = [
  { id: "dungeon", label: "Dungeon (torch)", darkOnly: true },
  ...defaultThemes
    .filter((theme) => theme.name in ALLOWED_PALETTES)
    .map((theme) => ({ id: theme.name, label: ALLOWED_PALETTES[theme.name] })),
];

const THEME_IDS = new Set(THEME_OPTIONS.map((option) => option.id));

export function isAppTheme(value: string | null | undefined): value is string {
  return typeof value === "string" && THEME_IDS.has(value);
}

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function isDarkOnly(theme: string) {
  return THEME_OPTIONS.find((option) => option.id === theme)?.darkOnly === true;
}

export function loadStoredTheme(): string {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (isAppTheme(saved)) return saved;
  } catch {
    /* ignore */
  }
  return "dungeon";
}

export function loadStoredMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    if (isThemeMode(saved)) return saved;
  } catch {
    /* ignore */
  }
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function applyTheme(theme: string, mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", isDarkOnly(theme) || mode === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}
