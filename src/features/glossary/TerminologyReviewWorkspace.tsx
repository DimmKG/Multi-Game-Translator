// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useState } from "react";

import { VirtualList } from "@/components/layout/VirtualList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TerminologyCandidate } from "@/core/terminology/extract-candidates";
import {
  loadTerminologyReviewState,
  saveTerminologyReviewState,
  type TerminologyReviewDecision,
  type TerminologyReviewState,
} from "@/core/terminology/review-persistence";
import { useI18n } from "@/features/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type DecisionFilter = "all" | TerminologyReviewDecision;

const DECISION_VARIANT: Record<TerminologyReviewDecision, "outline" | "secondary" | "destructive"> =
  {
    pending: "outline",
    accepted: "secondary",
    rejected: "destructive",
    "needs-review": "destructive",
  };

export function TerminologyReviewWorkspace({
  candidates,
  sessionId,
}: {
  candidates: readonly TerminologyCandidate[];
  sessionId: string;
}) {
  const { t } = useI18n();
  const validSources = useMemo(
    () => new Set(candidates.map((candidate) => candidate.source)),
    [candidates],
  );
  const [query, setQuery] = useState("");
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<TerminologyReviewState>(() =>
    loadTerminologyReviewState(sessionId, validSources),
  );

  const { decisions, preferredVariants } = reviewState;

  useEffect(() => {
    saveTerminologyReviewState(sessionId, reviewState);
  }, [reviewState, sessionId]);

  const decisionLabel = (decision: TerminologyReviewDecision) => {
    switch (decision) {
      case "accepted":
        return t("review.checked");
      case "rejected":
        return t("glossary.disabled");
      case "needs-review":
        return t("review.issues");
      default:
        return t("badge.missing");
    }
  };

  const decisionCounts = useMemo(() => {
    const counts: Record<TerminologyReviewDecision, number> = {
      pending: 0,
      accepted: 0,
      rejected: 0,
      "needs-review": 0,
    };
    for (const candidate of candidates) {
      counts[decisions[candidate.source] ?? "pending"] += 1;
    }
    return counts;
  }, [candidates, decisions]);

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return candidates.filter((candidate) => {
      const decision = decisions[candidate.source] ?? "pending";
      if (decisionFilter !== "all" && decision !== decisionFilter) return false;
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
  }, [candidates, conflictsOnly, decisionFilter, decisions, query]);

  const selectedCandidate =
    filteredCandidates.find((candidate) => candidate.source === selectedSource) ??
    filteredCandidates[0] ??
    null;
  const selectedDecision = selectedCandidate
    ? (decisions[selectedCandidate.source] ?? "pending")
    : null;
  const selectedPreferredVariants = selectedCandidate
    ? (preferredVariants[selectedCandidate.source] ?? {})
    : {};
  const canAccept =
    selectedCandidate != null &&
    selectedCandidate.languages.every(
      (language) => selectedPreferredVariants[language.languageCode]?.trim() !== "",
    );

  const setDecision = (decision: TerminologyReviewDecision) => {
    if (!selectedCandidate || (decision === "accepted" && !canAccept)) return;
    setReviewState((current) => {
      const nextDecisions = { ...current.decisions };
      if (decision === "pending") delete nextDecisions[selectedCandidate.source];
      else nextDecisions[selectedCandidate.source] = decision;
      return { ...current, decisions: nextDecisions };
    });
  };

  const setPreferredVariant = (languageCode: string, value: string) => {
    if (!selectedCandidate) return;
    setReviewState((current) => {
      const source = selectedCandidate.source;
      const nextForSource = { ...(current.preferredVariants[source] ?? {}) };
      if (value.trim()) nextForSource[languageCode] = value;
      else delete nextForSource[languageCode];

      const nextPreferredVariants = { ...current.preferredVariants };
      if (Object.keys(nextForSource).length > 0) nextPreferredVariants[source] = nextForSource;
      else delete nextPreferredVariants[source];

      const nextDecisions = { ...current.decisions };
      if (!value.trim() && nextDecisions[source] === "accepted") {
        nextDecisions[source] = "needs-review";
      }

      return {
        decisions: nextDecisions,
        preferredVariants: nextPreferredVariants,
      };
    });
  };

  const filters: DecisionFilter[] = ["all", "pending", "accepted", "rejected", "needs-review"];

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
          <div className="flex flex-wrap gap-1">
            {filters.map((filter) => {
              const count = filter === "all" ? candidates.length : decisionCounts[filter];
              const label = filter === "all" ? t("review.all") : decisionLabel(filter);
              return (
                <Button
                  key={filter}
                  size="sm"
                  variant={decisionFilter === filter ? "secondary" : "ghost"}
                  onClick={() => setDecisionFilter(filter)}
                >
                  {label}
                  <Badge variant="ghost" className="ms-1 h-4 min-w-4 px-1 text-[10px]">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        <VirtualList
          items={filteredCandidates}
          className="min-h-0 flex-1 overflow-auto p-2"
          estimateSize={() => 94}
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
            const decision = decisions[candidate.source] ?? "pending";
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
                <span className="flex min-w-0 items-center gap-2 text-xs">
                  <Badge variant={DECISION_VARIANT[decision]}>{decisionLabel(decision)}</Badge>
                  <span className="text-muted-foreground truncate">
                    {candidate.sourceKeys.slice(0, 3).join(", ")}
                  </span>
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
        {!selectedCandidate || !selectedDecision ? (
          <p className="text-muted-foreground text-sm">{t("empty.generic")}</p>
        ) : (
          <div className="grid gap-4">
            <header className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{selectedCandidate.source}</h3>
                <Badge variant="outline">{selectedCandidate.sourceFrequency}</Badge>
                <Badge variant={DECISION_VARIANT[selectedDecision]}>
                  {decisionLabel(selectedDecision)}
                </Badge>
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

            <div className="border-border flex flex-wrap gap-2 rounded-lg border p-3">
              <Button
                size="sm"
                disabled={!canAccept}
                variant={selectedDecision === "accepted" ? "secondary" : "outline"}
                onClick={() => setDecision("accepted")}
              >
                {t("review.checked")}
              </Button>
              <Button
                size="sm"
                variant={selectedDecision === "needs-review" ? "secondary" : "outline"}
                onClick={() => setDecision("needs-review")}
              >
                {t("review.issues")}
              </Button>
              <Button
                size="sm"
                variant={selectedDecision === "rejected" ? "destructive" : "outline"}
                onClick={() => setDecision("rejected")}
              >
                {t("glossary.disabled")}
              </Button>
              <Button
                size="sm"
                variant={selectedDecision === "pending" ? "secondary" : "ghost"}
                onClick={() => setDecision("pending")}
              >
                {t("badge.missing")}
              </Button>
            </div>

            <div className="grid gap-3">
              {selectedCandidate.languages.map((language) => {
                const preferred = selectedPreferredVariants[language.languageCode] ?? "";
                return (
                  <article
                    key={`${selectedCandidate.source}:${language.languageCode}`}
                    className="border-border grid gap-3 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{language.languageCode}</strong>
                      <Badge variant="outline">{language.matchedCount}</Badge>
                      {language.hasConflict && (
                        <Badge variant="destructive">{t("review.issues")}</Badge>
                      )}
                    </div>
                    <input
                      aria-label={`${t("review.trLabel")} · ${language.languageCode}`}
                      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                      value={preferred}
                      onChange={(event) =>
                        setPreferredVariant(language.languageCode, event.target.value)
                      }
                    />
                    <div className="grid gap-2">
                      {language.variants.map((variant) => (
                        <button
                          key={variant.value}
                          type="button"
                          className={cn(
                            "grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border px-3 py-2 text-start text-sm",
                            preferred === variant.value
                              ? "border-primary bg-muted"
                              : "bg-muted hover:border-border border-transparent",
                          )}
                          onClick={() => setPreferredVariant(language.languageCode, variant.value)}
                        >
                          <span>{variant.value}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {variant.count} · {Math.round(variant.ratio * 100)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
