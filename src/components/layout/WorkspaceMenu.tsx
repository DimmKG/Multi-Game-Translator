import {
  BookMarked,
  Download,
  FileDown,
  FilePlus2,
  FileUp,
  FolderOpen,
  Maximize2,
  Minimize2,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { LANGUAGE_OPTIONS } from "@/core/mt/target-language";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { isDarkOnly, THEME_OPTIONS, type ThemeMode } from "@/themes/themes";
import { cn } from "@/lib/utils";

const NO_LANGUAGE = "__none__";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="menu-section">
      <h3 className="menu-label">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Everything the header used to spread across a dozen buttons.
 *
 * The workspace has far more controls than fit a phone — and on a wide screen
 * the row of them was noise around the two things that matter, progress and
 * export. They all live here now, grouped by what they do.
 */
export function WorkspaceMenu({
  open,
  onOpenChange,
  theme,
  mode,
  onThemeChange,
  onModeChange,
  onOpenSettings,
  onOpenGlossaries,
  onPickLangFile,
  onPickReference,
  onPickProgress,
  onPickNewTranslation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: string;
  mode: ThemeMode;
  onThemeChange: (theme: string) => void;
  onModeChange: (mode: ThemeMode) => void;
  onOpenSettings: () => void;
  onOpenGlossaries: () => void;
  onPickLangFile: () => void;
  onPickReference: () => void;
  onPickProgress: () => void;
  onPickNewTranslation: () => void;
}) {
  const { t, language, setLanguage, locales } = useI18n();
  const workspace = useWorkspace();
  const darkOnly = isDarkOnly(theme);
  const effectiveMode: ThemeMode = darkOnly ? "dark" : mode;

  // Same reason as the header field: committing on every keystroke would
  // re-render and re-persist the whole entry list.
  const [filenameDraft, setFilenameDraft] = useState(workspace.filename);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setFilenameDraft(workspace.filename), [workspace.filename, open]);
  useEffect(() => () => clearTimeout(commitTimer.current ?? undefined), []);

  const saveLabel =
    workspace.saveState === "saving"
      ? t("save.saving")
      : workspace.saveState === "error"
        ? t("save.error")
        : workspace.savedAt
          ? t("save.savedAt", {
              time: new Date(workspace.savedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              n: workspace.progress.done,
            })
          : t("save.saved");

  const referenceMatches = workspace.items.filter(
    (item) => item.type === "entry" && item.ref != null,
  ).length;

  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="menu-sheet"
        // Otherwise the filename field grabs focus and selects itself on open.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{t("menu.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("menu.title")}</SheetDescription>
        </SheetHeader>

        <div className="menu-body">
          {workspace.isOpen && (
            <Section title={t("menu.file")}>
              <div className="menu-field">
                <Label htmlFor="menu-filename">{t("fname.label")}</Label>
                <Input
                  id="menu-filename"
                  type="text"
                  className="ltr-isolate font-mono"
                  spellCheck={false}
                  placeholder="*.lang"
                  value={filenameDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    setFilenameDraft(next);
                    if (commitTimer.current) clearTimeout(commitTimer.current);
                    commitTimer.current = setTimeout(() => workspace.setFilename(next), 400);
                  }}
                  onBlur={() => workspace.setFilename(filenameDraft)}
                />
              </div>
              <button type="button" className="menu-item" onClick={run(workspace.exportLang)}>
                <Download size={15} />
                {t("btn.export")}
              </button>
              <button type="button" className="menu-item" onClick={run(onPickLangFile)}>
                <FolderOpen size={15} />
                {t("btn.newFile")}
              </button>
              <button type="button" className="menu-item" onClick={run(onPickNewTranslation)}>
                <FilePlus2 size={15} />
                {t("btn.newTranslation")}
              </button>
            </Section>
          )}

          {workspace.isOpen && (
            <Section title={t("menu.progress")}>
              <p className={cn("menu-status", workspace.saveState)}>
                <span className="sdot" />
                {saveLabel}
              </p>
              <button
                type="button"
                className={cn("menu-item", !workspace.referenceAvailable && "warn")}
                onClick={run(onPickReference)}
              >
                <BookMarked size={15} />
                {workspace.referenceFilename
                  ? t("btn.enRefLoaded", {
                      file: workspace.referenceFilename,
                      n: referenceMatches,
                    })
                  : t("btn.enRef")}
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={run(() => void workspace.saveProgressFile())}
              >
                <FileDown size={15} />
                {t("btn.saveProgress")}
              </button>
              <button type="button" className="menu-item" onClick={run(onPickProgress)}>
                <FileUp size={15} />
                {t("btn.loadProgress")}
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={run(() => workspace.setCompactView(!workspace.compactView))}
              >
                {workspace.compactView ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                {t(workspace.compactView ? "compact.exit" : "compact.enter")}
              </button>
            </Section>
          )}

          {workspace.isOpen && (
            <Section title={t("menu.editing")}>
              <div className="menu-item menu-switch">
                <Label htmlFor="menu-spellcheck" className="flex-1 cursor-pointer font-normal">
                  {t("toggle.spell")}
                </Label>
                <Switch
                  id="menu-spellcheck"
                  size="sm"
                  checked={workspace.spellcheck}
                  title={t("toggle.spellTitle")}
                  onCheckedChange={(checked) => workspace.setSpellcheck(checked)}
                />
              </div>
              <div className="menu-item menu-switch">
                <Label htmlFor="menu-autocomplete" className="flex-1 cursor-pointer font-normal">
                  {t("toggle.ac")}
                </Label>
                <Switch
                  id="menu-autocomplete"
                  size="sm"
                  checked={workspace.autocompleteEnabled}
                  title={t("toggle.acTitle")}
                  onCheckedChange={(checked) => workspace.setAutocompleteEnabled(checked)}
                />
              </div>
            </Section>
          )}

          {workspace.isOpen && (
            <Section title={t("menu.translation")}>
              <div className="menu-field">
                <Label>{t("mt.label")}</Label>
                <Select
                  value={workspace.mtProvider}
                  onValueChange={(value) => workspace.setMtProvider(value)}
                >
                  <SelectTrigger className="w-full font-mono" title={t("mt.providerTitle")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {workspace.providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="menu-field">
                <Label>{t("mt.langLabel")}</Label>
                <Select
                  value={workspace.targetLanguage || NO_LANGUAGE}
                  onValueChange={(value) =>
                    workspace.setTargetLanguage(value === NO_LANGUAGE ? "" : value)
                  }
                >
                  <SelectTrigger className="w-full font-mono" title={t("mt.langTitle")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    <SelectItem value={NO_LANGUAGE}>—</SelectItem>
                    {LANGUAGE_OPTIONS.map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="menu-note">{t("mt.perLineHint")}</p>
            </Section>
          )}

          <Section title={t("menu.view")}>
            <div className="menu-field">
              <Label>{t("menu.uiLang")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  {locales.map((locale) => (
                    <SelectItem key={locale.code} value={locale.code}>
                      {locale.nativeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="menu-field">
              <Label>{t("menu.theme")}</Label>
              <Select value={theme} onValueChange={onThemeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              className="menu-item"
              disabled={darkOnly}
              onClick={() => onModeChange(effectiveMode === "dark" ? "light" : "dark")}
            >
              {effectiveMode === "dark" ? <Moon size={15} /> : <Sun size={15} />}
              {t("menu.mode")}
            </button>
          </Section>

          <Section title={t("menu.tools")}>
            <button type="button" className="menu-item" onClick={run(onOpenGlossaries)}>
              <BookMarked size={15} />
              {t("glossary.button")}
            </button>
            <button type="button" className="menu-item" onClick={run(onOpenSettings)}>
              <Settings size={15} />
              {t("settings.button")}
            </button>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
