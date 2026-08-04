// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeGlossary } from "@/core/glossary/loader";
import { buildTerminologyGlossaryEntryExport } from "@/core/terminology/glossary-entry-export";
import {
  applyTerminologyGlossaryMerge,
  planTerminologyGlossaryMerge,
} from "@/core/terminology/glossary-merge";
import {
  chooseTerminologyMergeTarget,
  compatibleTerminologyGlossaries,
} from "@/core/terminology/merge-selection";
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
  const compatibleGlossaries = useMemo(
    () =>
      entryExport
        ? compatibleTerminologyGlossaries(
            workspace.glossaries,
            entryExport.sourceLanguage,
            new Set(entryExport.languages.map((language) => language.targetLanguage)),
          )
        : [],
    [entryExport, workspace.glossaries],
  );
  const selectedGlossary = compatibleGlossaries.find(
    (glossary) => glossary.id === selectedGlossaryId,
  );
  const incoming = entryExport?.languages.find(
    (language) => language.targetLanguage === selectedGlossary?.targetLanguage,
  );
  const plan = useMemo(() => {
    if (!entryExport || !selectedGlossary || !incoming) return null;
    return planTerminologyGlossaryMerge(selectedGlossary, incoming, entryExport.sourceLanguage);
  }, [entryExport, incoming, selectedGlossary]);

  useEffect(() => {
    setSelectedGlossaryId((current) =>
      chooseTerminologyMergeTarget(
        current,
        compatibleGlossaries.map((glossary) => glossary.id),
      ),
    );
  }, [compatibleGlossaries]);

  const applyMerge = () => {
    if (!selectedGlossary || !plan || !plan.compatibility.compatible) return;
    const merged = applyTerminologyGlossaryMerge(selectedGlossary, plan);
    workspace.upsertGlossary(normalizeGlossary(merged));
    toast.success(
      t("terminology.mergeAdded", {
        n: plan.additions.length,
        name: selectedGlossary.name,
      }),
    );
  };

  if (!review || !entryExport || entryExport.languages.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border p-4 text-sm">
        {t("terminology.mergeNeedsAccepted")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid gap-4 pb-4">
        <section className="border-border grid gap-3 rounded-lg border p-3">
          <p className="text-muted-foreground text-sm">{t("terminology.loadedGlossaries")}</p>
          {compatibleGlossaries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {workspace.glossaries.length === 0
                ? t("terminology.noLoadedGlossaries")
                : t("terminology.noCompatibleGlossaries")}
            </p>
          ) : (
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("terminology.mergeTarget")}</span>
              <select
                className="border-input bg-background h-9 rounded-md border px-3"
                value={selectedGlossaryId}
                onChange={(event) => setSelectedGlossaryId(event.target.value)}
              >
                {compatibleGlossaries.length > 1 && (
                  <option value="" disabled>
                    {t("terminology.selectMergeTarget")}
                  </option>
                )}
                {compatibleGlossaries.map((glossary) => (
                  <option key={glossary.id} value={glossary.id}>
                    {glossary.name} · {glossary.sourceLanguage} → {glossary.targetLanguage} ·{" "}
                    {glossary.entries.length} {t("glossary.entries")}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        {plan?.compatibility.compatible && (
          <>
            <section className="border-border grid gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  +{plan.additions.length} {t("terminology.additions")}
                </Badge>
                <Badge variant="outline">
                  ={plan.identical.length} {t("terminology.identical")}
                </Badge>
                <Badge variant={plan.conflicts.length ? "destructive" : "outline"}>
                  !{plan.conflicts.length} {t("terminology.conflicts")}
                </Badge>
              </div>

              {plan.additions.length === 0 && plan.conflicts.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("terminology.mergeAllIdentical")}
                </p>
              )}
              {plan.additions.length === 0 && plan.conflicts.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  {t("terminology.mergeConflictsOnly")}
                </p>
              )}

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
                {t("terminology.addNewEntries")} · +{plan.additions.length}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
