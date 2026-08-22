// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { CompactBar } from "@/components/layout/CompactBar";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { CompareView } from "@/features/compare/CompareView";
import { EditorSidebar, EditorView } from "@/features/editor/EditorView";
import { TerminologyWorkspace } from "@/features/glossary/TerminologyWorkspace";
import { I18nProvider, useI18n } from "@/features/i18n/I18nProvider";
import { ReviewView } from "@/features/review/ReviewView";
import { Dropzone } from "@/features/workspace/Dropzone";
import { GameSelect } from "@/features/workspace/GameSelect";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { getModLoadWarnings } from "@/state/mod-bootstrap-warnings";
import { WorkspaceProvider, useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";
import { applyTheme, loadStoredMode, loadStoredTheme, type ThemeMode } from "@/themes/themes";

function Footnote() {
  const { t } = useI18n();
  const workspace = useWorkspace();

  const { entries } = workspace;
  const missing = entries.filter((entry) => entry.legacyStatus === "missing").length;
  const same = entries.filter((entry) => entry.legacyStatus === "same").length;
  const whitespace = workspace.whitespaceIssueCount;

  let text = t("footnote.main", {
    file: workspace.filename || "—",
    total: entries.length,
    missing,
  });
  if (same) text += t("footnote.same", { n: same });
  if (whitespace) text += t("footnote.ws", { n: whitespace });

  return (
    <div
      className={cn(
        "ltr-isolate compact:hidden kb-open:hidden",
        "text-foreground-faint bg-card flex-none border-t px-4 py-[9px] text-center text-[11.5px]",
        "max-[860px]:truncate max-[860px]:px-2.5 max-[860px]:py-[7px] max-[860px]:text-[11px]",
      )}
    >
      {text}
    </div>
  );
}

/** Every view is a column that owns its own scrolling, so the pane may not grow. */
const TAB_PANE = "flex min-h-0 min-w-0 flex-1 flex-col";

/** Kept from before the shadcn Sidebar landed: "1" means collapsed. */
const RAIL_STORAGE_KEY = "necesse-translator.sidebar-collapsed.v1";

function loadRailOpen() {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) !== "1";
  } catch {
    return true;
  }
}

function WorkspaceShell({
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

  const [railOpen, setRailOpen] = useState(loadRailOpen);
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_STORAGE_KEY, railOpen ? "0" : "1");
    } catch {
      /* private mode, or storage full — the rail just forgets */
    }
  }, [railOpen]);

  // Gated on workspace.ready: the not-ready branch below mounts its own
  // separate <Toaster/>, which unmounts (taking any toast with it) the
  // moment the ready branch's <Toaster/> takes over — firing before that
  // switch loses the toast to the remount instead of showing it.
  useEffect(() => {
    if (!workspace.ready) return;
    for (const warning of getModLoadWarnings()) {
      toast.warning(
        warning.scope === "catalog"
          ? t("modLoad.catalogFailed")
          : t("modLoad.modFailed", { id: warning.id ?? "?" }),
      );
    }
  }, [t, workspace.ready]);

  const reviewCount = workspace.entries.filter((entry) => entry.touched).length;

  if (!workspace.ready) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <AppHeader
          theme={theme}
          mode={mode}
          onThemeChange={onThemeChange}
          onModeChange={onModeChange}
        />
        <main className="text-foreground-faint flex flex-1 items-center justify-center text-sm">
          {t("glossary.loading")}
        </main>
        <Toaster position="bottom-center" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader
        theme={theme}
        mode={mode}
        onThemeChange={onThemeChange}
        onModeChange={onModeChange}
      />
      <CompactBar />

      {workspace.flowStage === "select-game" ? (
        <main className="flex min-h-0 flex-1 flex-row">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <GameSelect />
          </section>
        </main>
      ) : workspace.flowStage === "dropzone" ? (
        <main className="flex min-h-0 flex-1 flex-row">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Dropzone />
          </section>
        </main>
      ) : (
        <TabsPrimitive.Root
          value={workspace.view}
          onValueChange={(value) => workspace.setView(value as typeof workspace.view)}
          className="group/tabs flex min-h-0 flex-1"
          asChild
        >
          <div>
            <SidebarProvider open={railOpen} onOpenChange={setRailOpen}>
              {workspace.isOpen && workspace.view === "editor" && !workspace.compactView && (
                <EditorSidebar />
              )}
              <SidebarInset className="min-h-0 min-w-0">
                <div
                  className={cn(
                    "flex flex-none items-center px-4 py-2.5",
                    "max-[860px]:no-scrollbar max-[860px]:overflow-x-auto",
                  )}
                >
                  <TabsList>
                    {workspace.isOpen && (
                      <>
                        <TabsTrigger value="editor">{t("tab.editor")}</TabsTrigger>
                        <TabsTrigger value="review">
                          {t("tab.review")}
                          <Badge
                            variant="ghost"
                            className="text-muted-foreground h-4 min-w-4 px-1 font-mono text-[10px] tabular-nums"
                          >
                            {reviewCount}
                          </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="diff">{t("tab.diff")}</TabsTrigger>
                      </>
                    )}
                    <TabsTrigger value="terminology">{t("terminology.title")}</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="editor" className={TAB_PANE} tabIndex={-1}>
                  <EditorView />
                </TabsContent>
                <TabsContent value="review" className={TAB_PANE} tabIndex={-1}>
                  <ReviewView />
                </TabsContent>
                <TabsContent value="diff" className={TAB_PANE} tabIndex={-1}>
                  <CompareView />
                </TabsContent>
                <TabsContent
                  value="terminology"
                  className={cn(TAB_PANE, "data-[state=inactive]:hidden")}
                  tabIndex={-1}
                  forceMount
                >
                  <TerminologyWorkspace />
                </TabsContent>

                {workspace.isOpen && <Footnote />}
              </SidebarInset>
            </SidebarProvider>
          </div>
        </TabsPrimitive.Root>
      )}

      <Toaster position="bottom-center" />
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(loadStoredTheme);
  const [mode, setMode] = useState(loadStoredMode);

  useKeyboardInset();

  useEffect(() => {
    applyTheme(theme, mode);
  }, [theme, mode]);

  return (
    <TooltipProvider>
      <I18nProvider>
        <WorkspaceProvider>
          <WorkspaceShell
            theme={theme}
            mode={mode}
            onThemeChange={setTheme}
            onModeChange={setMode}
          />
        </WorkspaceProvider>
      </I18nProvider>
    </TooltipProvider>
  );
}
