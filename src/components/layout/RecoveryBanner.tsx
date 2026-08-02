import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

export function RecoveryBanner() {
  const { t } = useI18n();
  const { pendingRecovery, continueRecovery, startOverRecovery } = useWorkspace();
  if (!pendingRecovery) return null;

  const when = pendingRecovery.savedAt ? new Date(pendingRecovery.savedAt).toLocaleString() : "";

  return (
    // A full-width bar with two equal actions, not an Alert: that component
    // lays its single action out absolutely and has no room for a second.
    <div
      role="status"
      className={cn(
        "compact:hidden flex flex-none items-center gap-3.5 border-b px-4 py-2.5 text-sm",
        "bg-success-soft border-b-[color-mix(in_srgb,var(--success)_35%,var(--success-soft))]",
        "text-[color-mix(in_srgb,var(--success)_65%,var(--foreground))]",
        "max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-2.5",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <History size={16} aria-hidden="true" className="text-success shrink-0" />
        <div className="min-w-0 flex-1">
          {t("restore.found")} <b className="ltr-isolate">{pendingRecovery.filename || "—"}</b>
          {when && <span className="ltr-isolate"> ({when})</span>}
        </div>
      </div>
      {/* Both buttons are re-tinted: on a success-soft bar the stock primary is
          off-palette and the stock outline reads as background with a hairline.
          Under 760px the message and the pair stack — a filename plus a
          timestamp plus two buttons does not fit one phone-width row. */}
      <div className="flex flex-none items-center gap-3.5 max-[760px]:justify-end">
        <Button
          type="button"
          size="sm"
          className="bg-success text-success-soft hover:bg-success/85 font-semibold"
          onClick={continueRecovery}
        >
          {t("restore.continue")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "border-success bg-success/10 text-success",
            "hover:bg-success/20 hover:text-success",
            "dark:border-success dark:bg-success/10 dark:hover:bg-success/20",
          )}
          onClick={startOverRecovery}
        >
          {t("restore.startOver")}
        </Button>
      </div>
    </div>
  );
}
