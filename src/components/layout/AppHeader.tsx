import { Download, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WorkspaceMenu } from "@/components/layout/WorkspaceMenu";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

  // New translations start without a target filename — open the menu so the
  // pulsing field is visible instead of waiting for the user to find it.
  useEffect(() => {
    if (workspace.isOpen && !workspace.filename.trim()) setMenuOpen(true);
  }, [workspace.isOpen, workspace.filename]);

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
    // Chrome stays LTR even in an RTL interface: the workspace menu is a
    // physical side="right" sheet, so its trigger must stay on that edge.
    <header
      className={cn(
        "ltr-isolate compact:hidden kb-cramped:hidden",
        "flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5",
        "[background:var(--header-gradient)]",
        "max-[900px]:px-3",
        "max-[560px]:gap-x-2 max-[560px]:gap-y-[7px] max-[560px]:px-2.5 max-[560px]:py-2",
      )}
    >
      <div className="me-auto flex min-w-0 shrink items-baseline gap-2.5 select-none">
        <span
          className={cn(
            "text-primary font-mono text-[15px] font-bold tracking-[0.5px] whitespace-nowrap",
            "[text-shadow:0_0_14px_color-mix(in_srgb,var(--primary)_35%,transparent)]",
          )}
        >
          necesse.lang
        </span>
        <span
          className={cn(
            "text-foreground-faint text-[11px] tracking-[0.14em] whitespace-nowrap uppercase",
            "max-[560px]:hidden",
          )}
        >
          {t("app.sub")}
        </span>
      </div>

      {workspace.isOpen && (
        // Below 720px the meter takes a row of its own: brand, export and menu
        // already fill a phone's width, and a 40px bar tells you nothing.
        <div
          className={cn(
            "ms-1 flex max-w-[340px] min-w-[210px] flex-[0_1_300px] items-center gap-2.5",
            "max-[720px]:order-5 max-[720px]:ms-0 max-[720px]:min-w-0",
            "max-[720px]:max-w-none max-[720px]:flex-[1_1_100%]",
          )}
        >
          <Progress value={percent} className="h-2 flex-1" />
          <div className="ltr-isolate flex-none font-mono text-xs whitespace-nowrap">
            <b className="text-primary font-semibold">{workspace.progress.done}</b> /{" "}
            {workspace.progress.total} ({percent}%)
          </div>
          {/* Save state is status, not an action — a dot next to the progress it
              describes, with the wording in its tooltip and in the menu. */}
          <button
            type="button"
            className={cn(
              "size-[9px] flex-none cursor-pointer rounded-full border-0 p-0",
              "transition-[background-color,box-shadow] duration-200",
              "hover:outline-2 hover:outline-offset-2",
              workspace.saveState === "saving" && "bg-primary",
              workspace.saveState === "error" && "bg-warn",
              workspace.saveState === "saved" && [
                "bg-success shadow-[0_0_8px_color-mix(in_srgb,var(--success)_50%,transparent)]",
                "hover:outline-[color-mix(in_srgb,var(--success)_45%,transparent)]",
              ],
            )}
            title={`${saveLabel} — ${t("save.title")}`}
            aria-label={saveLabel}
            onClick={() => {
              workspace.setView("review");
              workspace.setReviewFilter("all");
            }}
          />
        </div>
      )}

      {/* Export and menu stay paired at the trailing edge, not adrift mid-bar. */}
      <div className="ms-auto flex flex-none items-center gap-2 max-[720px]:order-3">
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
