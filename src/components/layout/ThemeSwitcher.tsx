import { MoonStar, Palette, Sun } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyTheme, isDarkOnly, THEME_OPTIONS, type ThemeMode } from "@/themes/themes";

export function ThemeSwitcher({
  theme,
  mode,
  onThemeChange,
  onModeChange,
}: {
  theme: string;
  mode: ThemeMode;
  onThemeChange: (theme: string) => void;
  onModeChange: (mode: ThemeMode) => void;
}) {
  const darkOnly = isDarkOnly(theme);
  const effectiveMode: ThemeMode = darkOnly ? "dark" : mode;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="btn ghost icon" aria-label="Theme" title="Theme">
            <Palette size={15} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              applyTheme(value, mode);
              onThemeChange(value);
            }}
          >
            {THEME_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={option.id}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        className="btn ghost icon"
        disabled={darkOnly}
        aria-pressed={effectiveMode === "dark"}
        aria-label={effectiveMode === "dark" ? "Light mode" : "Dark mode"}
        title={effectiveMode === "dark" ? "Light mode" : "Dark mode"}
        onClick={() => {
          const next: ThemeMode = effectiveMode === "dark" ? "light" : "dark";
          applyTheme(theme, next);
          onModeChange(next);
        }}
      >
        {effectiveMode === "dark" ? <MoonStar size={15} /> : <Sun size={15} />}
      </button>
    </>
  );
}
