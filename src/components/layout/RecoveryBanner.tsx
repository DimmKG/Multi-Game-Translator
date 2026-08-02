import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";

export function RecoveryBanner() {
  const { t } = useI18n();
  const { pendingRecovery, continueRecovery, startOverRecovery } = useWorkspace();
  if (!pendingRecovery) return null;

  const when = pendingRecovery.savedAt ? new Date(pendingRecovery.savedAt).toLocaleString() : "";

  return (
    <div className="restore app-chrome">
      <History size={16} aria-hidden="true" className="shrink-0" />
      <div className="grow2">
        {t("restore.found")} <b className="ltr-isolate">{pendingRecovery.filename || "—"}</b>
        {when && <span className="ltr-isolate"> ({when})</span>}
      </div>
      <Button type="button" size="sm" onClick={continueRecovery}>
        {t("restore.continue")}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={startOverRecovery}>
        {t("restore.startOver")}
      </Button>
    </div>
  );
}
