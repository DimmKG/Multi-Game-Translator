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

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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

/** A row of the menu: full-width, icon then label; ghost + accent hover from Button. */
const MENU_ITEM = cn(
  "h-auto w-full justify-start gap-2.5 px-2.5 py-2 text-[13px] font-normal",
  "[&_svg]:text-muted-foreground hover:[&_svg]:text-accent-foreground",
  "disabled:opacity-45",
);

/** Label beside its control, rather than stacked — the sheet is a narrow column. */
const MENU_FIELD = "px-2.5 pt-1 pb-2 *:data-[slot=field-label]:flex-none";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-foreground-faint mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase">
        {title}
      </h3>
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

  const needsReference = workspace.settings.referenceReminder && !workspace.referenceAvailable;

  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0"
        // Otherwise the filename field grabs focus and selects itself on open.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{t("menu.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("menu.title")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-[18px] overflow-y-auto px-[18px] pb-[22px]">
          {workspace.isOpen && (
            <Section title={t("menu.file")}>
              <Field orientation="horizontal" className={MENU_FIELD}>
                <FieldLabel htmlFor="menu-filename">{t("fname.label")}</FieldLabel>
                <Input
                  id="menu-filename"
                  type="text"
                  className={cn(
                    "ltr-isolate min-w-0 flex-1 font-mono",
                    !filenameDraft.trim() && [
                      "animate-attention-pulse",
                      "border-[color-mix(in_srgb,var(--warn)_72%,var(--border))]",
                      "motion-reduce:animate-none",
                      "motion-reduce:shadow-[0_0_0_3px_color-mix(in_srgb,var(--warn)_22%,transparent)]",
                    ],
                  )}
                  spellCheck={false}
                  placeholder="*.lang"
                  title={t("fname.title")}
                  value={filenameDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    setFilenameDraft(next);
                    if (commitTimer.current) clearTimeout(commitTimer.current);
                    commitTimer.current = setTimeout(() => workspace.setFilename(next), 400);
                  }}
                  onBlur={() => workspace.setFilename(filenameDraft)}
                />
              </Field>
              <Button variant="ghost" className={MENU_ITEM} onClick={run(workspace.exportLang)}>
                <Download />
                {t("btn.export")}
              </Button>
              <Button variant="ghost" className={MENU_ITEM} onClick={run(onPickLangFile)}>
                <FolderOpen />
                {t("btn.newFile")}
              </Button>
              <Button variant="ghost" className={MENU_ITEM} onClick={run(onPickNewTranslation)}>
                <FilePlus2 />
                {t("btn.newTranslation")}
              </Button>
            </Section>
          )}

          {workspace.isOpen && (
            <Section title={t("menu.progress")}>
              <p className="mb-1.5 flex items-center gap-2 px-2.5 font-mono text-xs">
                <span
                  className={cn(
                    "size-2 flex-none rounded-full",
                    workspace.saveState === "saving" && "bg-primary",
                    workspace.saveState === "error" && "bg-warn",
                    workspace.saveState === "saved" && "bg-success",
                  )}
                />
                {saveLabel}
              </p>
              {/* Machine translation without a reference file silently produces
                  nothing useful, so when it is configured this row pulses. */}
              <Button
                variant="ghost"
                className={cn(
                  MENU_ITEM,
                  needsReference && [
                    "animate-attention-pulse border-[color-mix(in_srgb,var(--warn)_72%,var(--border))]",
                    "motion-reduce:animate-none",
                    "motion-reduce:shadow-[0_0_0_3px_color-mix(in_srgb,var(--warn)_22%,transparent)]",
                    "[&_svg]:text-warn",
                  ],
                )}
                onClick={run(onPickReference)}
              >
                <BookMarked />
                {workspace.referenceFilename
                  ? t("btn.enRefLoaded", {
                      file: workspace.referenceFilename,
                      n: referenceMatches,
                    })
                  : t("btn.enRef")}
              </Button>
              <Button
                variant="ghost"
                className={MENU_ITEM}
                onClick={run(() => void workspace.saveProgressFile())}
              >
                <FileDown />
                {t("btn.saveProgress")}
              </Button>
              <Button variant="ghost" className={MENU_ITEM} onClick={run(onPickProgress)}>
                <FileUp />
                {t("btn.loadProgress")}
              </Button>
              <Button
                variant="ghost"
                className={MENU_ITEM}
                onClick={run(() => workspace.setCompactView(!workspace.compactView))}
              >
                {workspace.compactView ? <Minimize2 /> : <Maximize2 />}
                {t(workspace.compactView ? "compact.exit" : "compact.enter")}
              </Button>
            </Section>
          )}

          {workspace.isOpen && (
            <Section title={t("menu.editing")}>
              <div className={cn(MENU_ITEM, "flex items-center rounded-lg")}>
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
              <div className={cn(MENU_ITEM, "flex items-center rounded-lg")}>
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
              <Field orientation="horizontal" className={MENU_FIELD}>
                <FieldLabel>{t("mt.label")}</FieldLabel>
                <Select
                  value={workspace.mtProvider}
                  onValueChange={(value) => workspace.setMtProvider(value)}
                >
                  <SelectTrigger className="min-w-0 flex-1 font-mono" title={t("mt.providerTitle")}>
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
              </Field>
              <Field orientation="horizontal" className={MENU_FIELD}>
                <FieldLabel>{t("mt.langLabel")}</FieldLabel>
                <Select
                  value={workspace.targetLanguage || NO_LANGUAGE}
                  onValueChange={(value) =>
                    workspace.setTargetLanguage(value === NO_LANGUAGE ? "" : value)
                  }
                >
                  <SelectTrigger className="min-w-0 flex-1 font-mono" title={t("mt.langTitle")}>
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
              </Field>
              <p className="text-muted-foreground mt-0.5 px-2.5 text-[11.5px]">
                {t("mt.perLineHint")}
              </p>
            </Section>
          )}

          <Section title={t("menu.view")}>
            <Field orientation="horizontal" className={MENU_FIELD}>
              <FieldLabel>{t("menu.uiLang")}</FieldLabel>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="min-w-0 flex-1">
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
            </Field>
            <Field orientation="horizontal" className={MENU_FIELD}>
              <FieldLabel>{t("menu.theme")}</FieldLabel>
              <Select value={theme} onValueChange={onThemeChange}>
                <SelectTrigger className="min-w-0 flex-1">
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
            </Field>
            <Button
              variant="ghost"
              className={MENU_ITEM}
              disabled={darkOnly}
              onClick={() => onModeChange(effectiveMode === "dark" ? "light" : "dark")}
            >
              {effectiveMode === "dark" ? <Moon /> : <Sun />}
              {t("menu.mode")}
            </Button>
          </Section>

          <Section title={t("menu.tools")}>
            <Button variant="ghost" className={MENU_ITEM} onClick={run(onOpenGlossaries)}>
              <BookMarked />
              {t("glossary.button")}
            </Button>
            <Button variant="ghost" className={MENU_ITEM} onClick={run(onOpenSettings)}>
              <Settings />
              {t("settings.button")}
            </Button>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
