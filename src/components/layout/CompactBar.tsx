// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CompactBar() {
  const { t } = useI18n();
  const { isOpen, compactView, filename, progress, saveState, setCompactView, savedAt } =
    useWorkspace();
  if (!isOpen || !compactView) return null;

  const saveLabel =
    saveState === "saving"
      ? t("save.saving")
      : saveState === "error"
        ? t("save.error")
        : savedAt
          ? t("save.savedAt", {
              time: new Date(savedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              n: progress.done,
            })
          : t("save.saved");

  return (
    <div
      className={cn(
        "bg-card sticky top-0 z-45 flex min-h-[42px] flex-none items-center gap-3 border-b px-4 py-1.5",
        "shadow-[0_8px_22px_var(--shadow-soft)]",
        "max-[760px]:gap-2 max-[760px]:px-2.5",
      )}
      aria-live="polite"
    >
      <div
        className={cn(
          "ltr-isolate max-w-[min(34vw,420px)] min-w-0 truncate font-mono font-bold",
          "max-[760px]:max-w-[38vw] max-[480px]:max-w-[58vw]",
        )}
        title={filename}
      >
        {filename || t("compact.unnamed")}
      </div>
      <div className="ltr-isolate min-w-0 truncate max-[480px]:hidden">
        {t("compact.progress", progress)}
      </div>
      <div className="ltr-isolate min-w-0 truncate max-[760px]:hidden">{saveLabel}</div>
      <div className="flex-1" />
      <Button
        type="button"
        variant="ghost"
        title={t("compact.exitTitle")}
        onClick={() => setCompactView(false)}
      >
        {t("compact.exit")}
      </Button>
    </div>
  );
}
