import { useEffect, useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { AppHeader } from "@/components/layout/AppHeader";
import { CompactBar } from "@/components/layout/CompactBar";
import { RecoveryBanner } from "@/components/layout/RecoveryBanner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { CompareView } from "@/features/compare/CompareView";
import { EditorSidebar, EditorView } from "@/features/editor/EditorView";
import { I18nProvider, useI18n } from "@/features/i18n/I18nProvider";
import { ReviewView } from "@/features/review/ReviewView";
import { Dropzone } from "@/features/workspace/Dropzone";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { WorkspaceProvider, useWorkspace } from "@/state/workspace-store";
import { statusOf, type TranslationEntry } from "@/core/lang/status";
import { scanWhitespace } from "@/core/tokens/whitespace";
import { cn } from "@/lib/utils";
import { applyTheme, loadStoredMode, loadStoredTheme, type ThemeMode } from "@/themes/themes";

function Footnote() {
  const { t } = useI18n();
  const workspace = useWorkspace();

  const entries = workspace.items.filter((item): item is TranslationEntry => item.type === "entry");
  const missing = entries.filter((entry) => statusOf(entry) === "missing").length;
  const same = entries.filter((entry) => statusOf(entry) === "same").length;
  const whitespace = entries.filter((entry) => scanWhitespace(entry).any).length;

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

  // The rail's expanded/collapsed state outlives the session, so SidebarProvider
  // runs controlled rather than on its own cookie.
  const [railOpen, setRailOpen] = useState(loadRailOpen);
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_STORAGE_KEY, railOpen ? "0" : "1");
    } catch {
      /* private mode, or storage full — the rail just forgets */
    }
  }, [railOpen]);

  const reviewCount = workspace.items.filter(
    (item) => item.type === "entry" && item.touched,
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader
        theme={theme}
        mode={mode}
        onThemeChange={onThemeChange}
        onModeChange={onModeChange}
      />
      <RecoveryBanner />
      <CompactBar />

      {!workspace.isOpen ? (
        <main className="workspace-main">
          <section className="work">
            <Dropzone />
          </section>
        </main>
      ) : (
        <TabsPrimitive.Root
          value={workspace.view}
          onValueChange={(value) => workspace.setView(value as "editor" | "review" | "diff")}
          // `group/tabs` is what TabsList and TabsTrigger key their layout off;
          // shadcn's own Tabs root supplies it, and we replace that root here.
          className="group/tabs flex min-h-0 flex-1"
          asChild
        >
          {/* Not a <main> — SidebarInset below is the one, and it may not nest. */}
          <div>
            <SidebarProvider open={railOpen} onOpenChange={setRailOpen}>
              {/* Only the editor has anything to filter, so the rail comes and
                  goes with the tab; the inset takes the whole width without it.
                  Unmounting is also how compact view drops it — hiding the panel
                  in CSS would leave its width reserved by the layout gap. */}
              {workspace.view === "editor" && !workspace.compactView && <EditorSidebar />}
              <SidebarInset className="min-h-0 min-w-0">
                <TabsList
                  variant="line"
                  className={cn(
                    "bg-card w-full flex-none justify-start gap-1 rounded-none border-b px-4 pt-2 pb-0",
                    "max-[860px]:no-scrollbar max-[860px]:overflow-x-auto max-[860px]:*:flex-none",
                  )}
                >
                  <TabsTrigger value="editor">{t("tab.editor")}</TabsTrigger>
                  <TabsTrigger value="review">
                    {t("tab.review")}
                    <span
                      className={cn(
                        "text-foreground-faint ms-1.5 font-mono text-[11px]",
                        "data-active:text-primary",
                      )}
                    >
                      {reviewCount}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="diff">{t("tab.diff")}</TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className={TAB_PANE} tabIndex={-1}>
                  <EditorView />
                </TabsContent>
                <TabsContent value="review" className={TAB_PANE} tabIndex={-1}>
                  <ReviewView />
                </TabsContent>
                <TabsContent value="diff" className={TAB_PANE} tabIndex={-1}>
                  <CompareView />
                </TabsContent>

                <Footnote />
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
