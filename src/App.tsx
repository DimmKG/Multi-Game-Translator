import { useEffect, useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { AppHeader } from "@/components/layout/AppHeader";
import { CompactBar } from "@/components/layout/CompactBar";
import { RecoveryBanner } from "@/components/layout/RecoveryBanner";
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

  return <div className="footnote app-chrome ltr-isolate">{text}</div>;
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

  const [filtersOpen, setFiltersOpen] = useState(false);

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
          className="workspace-main"
          asChild
        >
          <main>
            {workspace.view === "editor" && (
              <EditorSidebar mobileOpen={filtersOpen} onMobileOpenChange={setFiltersOpen} />
            )}
            <section className="work">
              <TabsPrimitive.List className="tabs">
                <TabsPrimitive.Trigger className="tab" value="editor">
                  {t("tab.editor")}
                </TabsPrimitive.Trigger>
                <TabsPrimitive.Trigger className="tab" value="review">
                  {t("tab.review")}
                  <span className="tcount">{reviewCount}</span>
                </TabsPrimitive.Trigger>
                <TabsPrimitive.Trigger className="tab" value="diff">
                  {t("tab.diff")}
                </TabsPrimitive.Trigger>
              </TabsPrimitive.List>

              <TabsPrimitive.Content value="editor" className="work" tabIndex={-1}>
                <EditorView onOpenFilters={() => setFiltersOpen(true)} />
              </TabsPrimitive.Content>
              <TabsPrimitive.Content value="review" className="work" tabIndex={-1}>
                <ReviewView />
              </TabsPrimitive.Content>
              <TabsPrimitive.Content value="diff" className="work" tabIndex={-1}>
                <CompareView />
              </TabsPrimitive.Content>

              <Footnote />
            </section>
          </main>
        </TabsPrimitive.Root>
      )}

      <Toaster position="bottom-center" />
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState("dungeon");
  const [mode, setMode] = useState<ThemeMode>("dark");

  useKeyboardInset();

  useEffect(() => {
    const storedTheme = loadStoredTheme();
    const storedMode = loadStoredMode();
    applyTheme(storedTheme, storedMode);
    setTheme(storedTheme);
    setMode(storedMode);
  }, []);

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
