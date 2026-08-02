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

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LANGUAGE_OPTIONS } from "@/core/mt/target-language";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { isDarkOnly, THEME_OPTIONS, type ThemeMode } from "@/themes/themes";
import { cn } from "@/lib/utils";

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
              <label className="menu-field">
                <span>{t("fname.label")}</span>
                <input
                  type="text"
                  className="ltr-isolate"
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
              </label>
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
              <button
                type="button"
                className="menu-item"
                aria-pressed={workspace.spellcheck}
                title={t("toggle.spellTitle")}
                onClick={() => workspace.setSpellcheck(!workspace.spellcheck)}
              >
                <span className={cn("tk", workspace.spellcheck && "on")} aria-hidden="true" />
                {t("toggle.spell")}
              </button>
              <button
                type="button"
                className="menu-item"
                aria-pressed={workspace.autocompleteEnabled}
                title={t("toggle.acTitle")}
                onClick={() => workspace.setAutocompleteEnabled(!workspace.autocompleteEnabled)}
              >
                <span
                  className={cn("tk", workspace.autocompleteEnabled && "on")}
                  aria-hidden="true"
                />
                {t("toggle.ac")}
              </button>
            </Section>
          )}

          {workspace.isOpen && (
            <Section title={t("menu.translation")}>
              <label className="menu-field">
                <span>{t("mt.label")}</span>
                <select
                  value={workspace.mtProvider}
                  title={t("mt.providerTitle")}
                  onChange={(event) => workspace.setMtProvider(event.target.value)}
                >
                  {workspace.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="menu-field">
                <span>{t("mt.langLabel")}</span>
                <select
                  value={workspace.targetLanguage}
                  title={t("mt.langTitle")}
                  onChange={(event) => workspace.setTargetLanguage(event.target.value)}
                >
                  <option value="">—</option>
                  {LANGUAGE_OPTIONS.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label} ({code})
                    </option>
                  ))}
                </select>
              </label>
              <p className="menu-note">{t("mt.perLineHint")}</p>
            </Section>
          )}

          <Section title={t("menu.view")}>
            <label className="menu-field">
              <span>{t("menu.uiLang")}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                {locales.map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.nativeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="menu-field">
              <span>{t("menu.theme")}</span>
              <select value={theme} onChange={(event) => onThemeChange(event.target.value)}>
                {THEME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
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
