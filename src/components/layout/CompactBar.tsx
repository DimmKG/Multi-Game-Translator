import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { Button } from "@/components/ui/button";

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
    <div className="compact-bar" aria-live="polite">
      <div className="compact-file" title={filename}>
        {filename || t("compact.unnamed")}
      </div>
      <div className="compact-progress">{t("compact.progress", progress)}</div>
      <div className="compact-save">{saveLabel}</div>
      <div className="compact-spacer" />
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
