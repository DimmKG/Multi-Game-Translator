// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { fetchCatalog, fetchGlossary, loadLocalGlossary } from "@/core/glossary/loader";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";

const isHttp = typeof location !== "undefined" && location.protocol.startsWith("http");

export function GlossaryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { glossaries, upsertGlossary, removeGlossary, setGlossaryEnabled } = useWorkspace();
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("glossary.title")}</DialogTitle>
          <DialogDescription>{t("glossary.intro")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json,application/json";
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                void loadLocalGlossary(file)
                  .then((glossary) => {
                    const replaced = glossaries.some((item) => item.id === glossary.id);
                    upsertGlossary(glossary);
                    toast.success(replaced ? t("glossary.replaced") : t("glossary.loaded"));
                  })
                  .catch((error: Error) => toast.error(t("glossary.error") + error.message));
              };
              input.click();
            }}
          >
            {t("glossary.import")}
          </Button>
          {isHttp ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void fetchCatalog("./glossaries/catalog.json")
                  .then(async (catalog) => {
                    for (const item of catalog.glossaries) {
                      if (!item.enabled) continue;
                      const glossary = await fetchGlossary(item.url);
                      upsertGlossary(glossary);
                    }
                    toast.success(t("glossary.loaded"));
                  })
                  .catch((error: Error) => toast.error(t("glossary.error") + error.message))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? t("glossary.loading") : t("glossary.catalog")}
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">{t("glossary.offline")}</p>
          )}
        </div>

        <ScrollArea className="border-border h-[50vh] rounded-lg border">
          <div className="grid gap-2 p-3">
            {glossaries.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("glossary.empty")}</p>
            )}
            {glossaries.map((glossary) => (
              <div
                key={glossary.id}
                className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{glossary.name}</strong>
                    <Badge variant="secondary">{glossary.targetLanguage}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {glossary.entries.length} {t("glossary.entries")}
                    </span>
                  </div>
                  <p className="ltr-isolate text-muted-foreground text-xs">{glossary.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={glossary.enabled}
                    onCheckedChange={(checked) => setGlossaryEnabled(glossary.id, checked)}
                    aria-label={glossary.enabled ? t("glossary.enabled") : t("glossary.disabled")}
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeGlossary(glossary.id)}>
                    {t("glossary.remove")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
