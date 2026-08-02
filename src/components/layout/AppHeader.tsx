import { Download, Menu } from "lucide-react";
import { useRef, useState } from "react";

import { WorkspaceMenu } from "@/components/layout/WorkspaceMenu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/I18nProvider";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { GlossaryDialog } from "@/features/glossary/GlossaryDialog";
import { useWorkspace } from "@/state/workspace-store";
import type { ThemeMode } from "@/themes/themes";
import { cn } from "@/lib/utils";

/**
 * Deliberately sparse: identity, how far along you are, the one action you came
 * to perform, and a menu for everything else. Every other control moved into
 * WorkspaceMenu — a phone has no room for a dozen buttons, and on a desktop
 * they only crowded the two things that matter.
 */
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
  const { t } = useI18n();
  const workspace = useWorkspace();
  const fileInput = useRef<HTMLInputElement>(null);
  const referenceInput = useRef<HTMLInputElement>(null);
  const progressInput = useRef<HTMLInputElement>(null);
  const newTranslationInput = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const percent =
    workspace.progress.total === 0
      ? 0
      : Math.round((workspace.progress.done / workspace.progress.total) * 100);

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

      {workspace.isOpen && (
        <>
          <div className="meter">
            <div className="bar">
              <div className="fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="pct ltr-isolate">
              <b>{workspace.progress.done}</b> / {workspace.progress.total} ({percent}%)
            </div>
            {/* Save state is status, not an action — a dot next to the progress it
                describes, with the wording in its tooltip and in the menu. */}
            <button
              type="button"
              className={cn("savedot", workspace.saveState !== "saved" && workspace.saveState)}
              title={`${saveLabel} — ${t("save.title")}`}
              aria-label={saveLabel}
              onClick={() => {
                workspace.setView("review");
                workspace.setReviewFilter("all");
              }}
            />
          </div>
        </>
      )}

      {/* Export and menu stay paired at the trailing edge, not adrift mid-bar. */}
      <div className="header-actions">
        {workspace.isOpen && (
          <Button
            type="button"
            size="icon"
            aria-label={t("btn.export")}
            title={t("btn.export")}
            onClick={workspace.exportLang}
          >
            <Download />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="menu-trigger"
          aria-label={t("menu.open")}
          title={t("menu.open")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu />
        </Button>
      </div>

      <WorkspaceMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        theme={theme}
        mode={mode}
        onThemeChange={onThemeChange}
        onModeChange={onModeChange}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGlossaries={() => setGlossaryOpen(true)}
        onPickLangFile={() => fileInput.current?.click()}
        onPickReference={() => referenceInput.current?.click()}
        onPickProgress={() => progressInput.current?.click()}
        onPickNewTranslation={() => newTranslationInput.current?.click()}
      />

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
