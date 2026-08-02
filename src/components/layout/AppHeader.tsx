import { useEffect, useRef, useState } from "react";

import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { useI18n } from "@/features/i18n/I18nProvider";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { GlossaryDialog } from "@/features/glossary/GlossaryDialog";
import { useWorkspace } from "@/state/workspace-store";
import type { ThemeMode } from "@/themes/themes";
import { cn } from "@/lib/utils";

export function AppHeader({
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
  const { t, language, setLanguage, locales } = useI18n();
  const workspace = useWorkspace();
  const fileInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const progressInput = useRef<HTMLInputElement>(null);
  const newTranslationInput = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  // Typing here must not re-render (and re-persist) the whole entry list on every
  // keystroke, so the field owns its value and commits to the store on a debounce.
  const [filenameDraft, setFilenameDraft] = useState(workspace.filename);
  const filenameFocused = useRef(false);
  const commitFilename = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filenameFocused.current) setFilenameDraft(workspace.filename);
  }, [workspace.filename]);

  useEffect(() => () => clearTimeout(commitFilename.current ?? undefined), []);

  const percent =
    workspace.progress.total === 0
      ? 0
      : Math.round((workspace.progress.done / workspace.progress.total) * 100);

  const referenceNeedsReminder =
    workspace.settings.referenceReminder && workspace.isOpen && !workspace.referenceAvailable;

  const referenceMatches = workspace.items.filter(
    (item) => item.type === "entry" && item.ref != null,
  ).length;

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

  return (
    <header className="app-header app-chrome">
      <div className="brand">
        <span className="mark">necesse.lang</span>
        <span className="sub">{t("app.sub")}</span>
      </div>

      <select
        className="uilang"
        aria-label="Interface language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        {locales.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.nativeName}
          </option>
        ))}
      </select>

      <ThemeSwitcher
        theme={theme}
        mode={mode}
        onThemeChange={onThemeChange}
        onModeChange={onModeChange}
      />

      <button
        type="button"
        className="btn ghost"
        onClick={() => setSettingsOpen(true)}
        title={t("settings.button")}
      >
        {t("settings.button")}
      </button>
      <button type="button" className="btn ghost" onClick={() => setGlossaryOpen(true)}>
        {t("glossary.button")}
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={!workspace.isOpen}
        aria-pressed={workspace.compactView}
        title={t(workspace.compactView ? "compact.exitTitle" : "compact.enterTitle")}
        onClick={() => workspace.setCompactView(!workspace.compactView)}
      >
        {t(workspace.compactView ? "compact.exit" : "compact.enter")}
      </button>

      {workspace.isOpen && (
        <div className="meter">
          <div className="bar">
            <div className="fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="pct ltr-isolate">
            <b>{workspace.progress.done}</b> / {workspace.progress.total} ({percent}%)
          </div>
        </div>
      )}

      {workspace.isOpen && (
        <div className="filebar">
          <button
            type="button"
            className={cn("savepill", workspace.saveState !== "saved" && workspace.saveState)}
            title={t("save.title")}
            onClick={() => {
              workspace.setView("review");
              workspace.setReviewFilter("all");
            }}
          >
            <span className="sdot" />
            <span className="stext">{saveLabel}</span>
          </button>

          <button
            type="button"
            className={cn("btn ghost", referenceNeedsReminder && "warn")}
            onClick={() => referenceInput.current?.click()}
            title={
              workspace.referenceFilename
                ? t("btn.enRefLoadedTitle", {
                    file: workspace.referenceFilename,
                    n: referenceMatches,
                  })
                : t("btn.enRefTitle")
            }
          >
            {workspace.referenceFilename
              ? t("btn.enRefLoaded", { file: workspace.referenceFilename, n: referenceMatches })
              : t("btn.enRef")}
          </button>
          <button
            type="button"
            className="btn ghost"
            title={t("btn.saveProgressTitle")}
            onClick={() => void workspace.saveProgressFile()}
          >
            {t("btn.saveProgress")}
          </button>
          <button
            type="button"
            className="btn ghost"
            title={t("btn.loadProgressTitle")}
            onClick={() => progressInput.current?.click()}
          >
            {t("btn.loadProgress")}
          </button>
          <button
            type="button"
            className="btn ghost"
            title={t("btn.newTranslationTitle")}
            onClick={() => newTranslationInput.current?.click()}
          >
            {t("btn.newTranslation")}
          </button>
          <button
            type="button"
            className="btn ghost"
            title={t("btn.newFileTitle")}
            onClick={() => fileInput.current?.click()}
          >
            {t("btn.newFile")}
          </button>

          <label className="fname" title={t("fname.title")}>
            <span>{t("fname.label")}</span>
            <input
              type="text"
              className="ltr-isolate"
              spellCheck={false}
              value={filenameDraft}
              placeholder="*.lang"
              onFocus={() => {
                filenameFocused.current = true;
              }}
              onChange={(event) => {
                const next = event.target.value;
                setFilenameDraft(next);
                if (commitFilename.current) clearTimeout(commitFilename.current);
                commitFilename.current = setTimeout(() => workspace.setFilename(next), 400);
              }}
              onBlur={() => {
                filenameFocused.current = false;
                if (commitFilename.current) clearTimeout(commitFilename.current);
                if (filenameDraft !== workspace.filename) workspace.setFilename(filenameDraft);
              }}
            />
          </label>

          <button type="button" className="btn primary" onClick={workspace.exportLang}>
            {t("btn.export")}
          </button>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".lang,.txt"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void workspace.openLangFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={referenceInput}
        type="file"
        accept=".lang,.txt"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void workspace.loadReferenceFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={progressInput}
        type="file"
        accept=".json,.gz,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void workspace.loadProgressFile(file);
          event.target.value = "";
        }}
      />
      <input
        ref={newTranslationInput}
        type="file"
        accept=".lang,.txt"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void workspace.createFromReferenceFile(file);
          event.target.value = "";
        }}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <GlossaryDialog open={glossaryOpen} onOpenChange={setGlossaryOpen} />
    </header>
  );
}
