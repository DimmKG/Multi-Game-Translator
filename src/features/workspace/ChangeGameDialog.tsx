// SPDX-License-Identifier: AGPL-3.0-or-later
import { Download, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";

/**
 * Confirms before dropping the open document back to the game-selection
 * screen — closeWorkspace() itself has no memory of what was unsaved, so this
 * is the only place the user gets to export/save-progress on the way out.
 */
export function ChangeGameDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const workspace = useWorkspace();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changeGame.title")}</DialogTitle>
          <DialogDescription>{t("changeGame.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2.5"
            onClick={() => workspace.exportLang()}
          >
            <Download />
            {t("btn.export")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2.5"
            onClick={() => void workspace.saveProgressFile()}
          >
            <FileDown />
            {t("btn.saveProgress")}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("changeGame.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              workspace.closeWorkspace();
            }}
          >
            {t("changeGame.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
