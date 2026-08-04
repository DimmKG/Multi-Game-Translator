// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeGlossary } from "@/core/glossary/loader";
import { buildTerminologyGlossaryEntryExport } from "@/core/terminology/glossary-entry-export";
import {
  applyTerminologyGlossaryMerge,
  planTerminologyGlossaryMerge,
} from "@/core/terminology/glossary-merge";
import type { TerminologyReviewExport } from "@/core/terminology/review-export";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";

export function TerminologyGlossaryMergeWorkspace({
  review,
}: {
  review: TerminologyReviewExport | null;
}) {
  const { t } = useI18n();
  const workspace = useWorkspace();
  const [selectedGlossaryId, setSelectedGlossaryId] = useState("");

  const entryExport = useMemo(
    () => (review ? buildTerminologyGlossaryEntryExport(review) : null),
    [review],
  );
  const selectedGlossary = workspace.glossaries.find(
    (glossary) => glossary.id === selectedGlossaryId,
  );
  const incoming = entryExport?.languages.find(
    (language) => language.targetLanguage === selectedGlossary?.targetLanguage,
  );
  const plan = useMemo(() => {
    if (!entryExport || !selectedGlossary || !incoming) return null;
    return planTerminologyGlossaryMerge(selectedGlossary, incoming, entryExport.sourceLanguage);
  }, [entryExport, incoming, selectedGlossary]);

  const applyMerge = () => {
    if (!selectedGlossary || !plan || !plan.compatibility.compatible) return;
    const merged = applyTerminologyGlossaryMerge(selectedGlossary, plan);
    workspace.upsertGlossary(normalizeGlossary(merged));
    toast.success(t("glossary.replaced"));
  };

  if (!review || !entryExport || entryExport.languages.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border p-4 text-sm">
        {t("empty.generic")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid gap-4 pb-4">
        <section className="border-border grid gap-3 rounded-lg border p-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("glossary.button")}</span>
            <select
              className="border-input bg-background h-9 rounded-md border px-3"
              value={selectedGlossaryId}
              onChange={(event) => setSelectedGlossaryId(event.target.value)}
            >
              <option value="">{t("glossary.empty")}</option>
              {workspace.glossaries.map((glossary) => (
                <option key={glossary.id} value={glossary.id}>
                  {glossary.name} · {glossary.sourceLanguage} → {glossary.targetLanguage} ·{" "}
                  {glossary.entries.length} {t("glossary.entries")}
                </option>
              ))}
            </select>
          </label>

          {selectedGlossary && !incoming && (
            <p className="text-destructive text-sm">
              {selectedGlossary.targetLanguage} · {t("empty.noMatch")}
            </p>
          )}

          {plan && !plan.compatibility.compatible && (
            <p className="text-destructive text-sm">
              {plan.compatibility.reason}: {plan.compatibility.actual} ≠{" "}
              {plan.compatibility.expected}
            </p>
          )}
        </section>

        {plan?.compatibility.compatible && (
          <>
            <section className="border-border grid gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  +{plan.additions.length} {t("glossary.entries")}
                </Badge>
                <Badge variant="outline">={plan.identical.length}</Badge>
                <Badge variant={plan.conflicts.length ? "destructive" : "outline"}>
                  !{plan.conflicts.length}
                </Badge>
              </div>

              {plan.additions.length > 0 && (
                <div className="grid gap-1">
                  {plan.additions.map((entry) => (
                    <div
                      key={`${entry.source}\u0000${entry.target}`}
                      className="grid grid-cols-2 gap-3 text-sm"
                    >
                      <span className="truncate" title={entry.source}>
                        {entry.source}
                      </span>
                      <span className="truncate" title={entry.target}>
                        {entry.target}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {plan.conflicts.length > 0 && (
              <section className="border-destructive/50 grid gap-2 rounded-lg border p-3">
                {plan.conflicts.map((conflict) => (
                  <div key={conflict.incoming.source} className="grid gap-1 text-sm">
                    <strong>{conflict.incoming.source}</strong>
                    <span>
                      {conflict.incoming.target} ≠{" "}
                      {conflict.existing.map((entry) => entry.target).join(" / ")}
                    </span>
                  </div>
                ))}
              </section>
            )}

            <div className="flex justify-end">
              <Button disabled={plan.additions.length === 0} onClick={applyMerge}>
                {t("glossary.install")} · +{plan.additions.length}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
