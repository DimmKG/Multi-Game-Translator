// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TerminologyRuleMatch } from "@/core/glossary/matcher";
import { useI18n } from "@/features/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export function TerminologyRuleDialog({
  open,
  onOpenChange,
  matches,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: readonly TerminologyRuleMatch[];
}) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("terminology.rulesTitle")}</DialogTitle>
          <DialogDescription>{t("terminology.rulesDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {matches.map((match, index) => {
            const words = [match.target, ...match.forms, ...match.alternatives].filter(Boolean);
            return (
              <section
                key={`${match.glossaryId}:${match.source}:${index}`}
                className="border-border grid gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {match.issues.length > 0 ? (
                    <TriangleAlert className="text-warn shrink-0" size={16} aria-hidden="true" />
                  ) : (
                    <CircleCheck className="text-success shrink-0" size={16} aria-hidden="true" />
                  )}
                  <strong className="ltr-isolate">
                    {match.source} → {match.target}
                  </strong>
                  {match.glossaryName && (
                    <Badge variant="secondary" className="ltr-isolate">
                      {match.glossaryName}
                    </Badge>
                  )}
                </div>

                {match.context && (
                  <p className="text-muted-foreground text-[13.5px] leading-[1.55]">
                    {match.context}
                  </p>
                )}
                {match.note && (
                  <p className="text-muted-foreground text-[13.5px] leading-[1.55]">{match.note}</p>
                )}

                {words.length > 0 && (
                  <p className="ltr-isolate text-xs">
                    <span className="text-muted-foreground">
                      {t("terminology.availableWords")}:{" "}
                    </span>
                    {words.join(", ")}
                  </p>
                )}
                {match.forbidden.length > 0 && (
                  <p className="ltr-isolate text-xs">
                    <span className="text-muted-foreground">
                      {t("glossary.authoring.forbidden")}:{" "}
                    </span>
                    {match.forbidden.join(", ")}
                  </p>
                )}

                <div className="grid gap-1">
                  {match.issues.length > 0 ? (
                    match.issues.map((issue, issueIndex) => (
                      <div
                        key={`${issue.type}-${issueIndex}`}
                        className={cn("text-warn flex items-start gap-1.5 text-xs")}
                      >
                        <TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                        <span>
                          {issue.type === "forbidden"
                            ? t("terminology.forbidden", {
                                found: issue.found ?? issue.source,
                                preferred: issue.preferred,
                              })
                            : t("terminology.missing", {
                                source: issue.source,
                                preferred: issue.preferred,
                              })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-success flex items-center gap-1.5 text-xs">
                      <CircleCheck size={13} aria-hidden="true" className="shrink-0" />
                      {t("terminology.ruleOk")}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
