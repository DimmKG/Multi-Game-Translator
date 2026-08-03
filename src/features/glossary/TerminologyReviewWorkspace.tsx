// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";

import { VirtualList } from "@/components/layout/VirtualList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TerminologyCandidate } from "@/core/terminology/extract-candidates";
import { useI18n } from "@/features/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export function TerminologyReviewWorkspace({
  candidates,
}: {
  candidates: readonly TerminologyCandidate[];
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return candidates.filter((candidate) => {
      if (conflictsOnly && !candidate.languages.some((language) => language.hasConflict)) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        candidate.source.toLocaleLowerCase().includes(normalizedQuery) ||
        candidate.sourceKeys.some((key) => key.toLocaleLowerCase().includes(normalizedQuery)) ||
        candidate.languages.some((language) =>
          language.variants.some((variant) =>
            variant.value.toLocaleLowerCase().includes(normalizedQuery),
          ),
        )
      );
    });
  }, [candidates, conflictsOnly, query]);

  const selectedCandidate =
    filteredCandidates.find((candidate) => candidate.source === selectedSource) ??
    filteredCandidates[0] ??
    null;

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(24rem,1.15fr)]">
      <section className="border-border flex min-h-0 flex-col overflow-hidden rounded-lg border">
        <div className="border-border grid gap-2 border-b p-3">
          <input
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            placeholder={t("review.searchPh")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={conflictsOnly ? "secondary" : "outline"}
              onClick={() => setConflictsOnly((current) => !current)}
            >
              {t("review.issues")}
            </Button>
            <span className="text-muted-foreground text-xs tabular-nums">
              {filteredCandidates.length} / {candidates.length}
            </span>
          </div>
        </div>

        <VirtualList
          items={filteredCandidates}
          className="min-h-0 flex-1 overflow-auto p-2"
          estimateSize={() => 82}
          overscan={10}
          getKey={(candidate) => candidate.source}
          empty={
            <p className="text-muted-foreground p-3 text-sm">
              {candidates.length === 0 ? t("empty.generic") : t("empty.noMatch")}
            </p>
          }
          renderItem={(candidate) => {
            const conflictCount = candidate.languages.filter(
              (language) => language.hasConflict,
            ).length;
            const selected = candidate.source === selectedCandidate?.source;
            return (
              <button
                type="button"
                className={cn(
                  "border-border mb-2 grid w-full gap-1 rounded-md border p-3 text-start",
                  "hover:bg-muted/60 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  selected && "bg-muted",
                )}
                onClick={() => setSelectedSource(candidate.source)}
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <strong className="truncate">{candidate.source}</strong>
                  <Badge variant="outline">{candidate.sourceFrequency}</Badge>
                </span>
                <span className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
                  <span className="truncate">{candidate.sourceKeys.slice(0, 3).join(", ")}</span>
                  {conflictCount > 0 && (
                    <Badge variant="destructive" className="ms-auto shrink-0">
                      {conflictCount}
                    </Badge>
                  )}
                </span>
              </button>
            );
          }}
        />
      </section>

      <section className="border-border min-h-0 overflow-auto rounded-lg border p-4">
        {!selectedCandidate ? (
          <p className="text-muted-foreground text-sm">{t("empty.generic")}</p>
        ) : (
          <div className="grid gap-4">
            <header className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{selectedCandidate.source}</h3>
                <Badge variant="outline">{selectedCandidate.sourceFrequency}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedCandidate.sections.filter(Boolean).map((section) => (
                  <Badge key={section} variant="secondary">
                    {section}
                  </Badge>
                ))}
              </div>
              <p className="ltr-isolate text-muted-foreground text-xs break-all">
                {selectedCandidate.sourceKeys.join(", ")}
              </p>
            </header>

            <div className="grid gap-3">
              {selectedCandidate.languages.map((language) => (
                <article
                  key={`${selectedCandidate.source}:${language.languageCode}`}
                  className="border-border grid gap-2 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{language.languageCode}</strong>
                    <Badge variant="outline">{language.matchedCount}</Badge>
                    {language.hasConflict && (
                      <Badge variant="destructive">{t("review.issues")}</Badge>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {language.variants.map((variant) => (
                      <div
                        key={variant.value}
                        className="bg-muted grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md px-3 py-2 text-sm"
                      >
                        <span>{variant.value}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {variant.count} · {Math.round(variant.ratio * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
