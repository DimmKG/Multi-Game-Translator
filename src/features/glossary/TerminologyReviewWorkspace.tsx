// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";

import { VirtualList } from "@/components/layout/VirtualList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TerminologyCandidate } from "@/core/terminology/extract-candidates";
import type {
  TerminologyCandidateKind,
  TerminologyReviewDecision,
  TerminologyReviewState,
  TerminologyVariantClassification,
} from "@/core/terminology/review-persistence";
import {
  canAcceptTerminologyCandidate,
  effectiveTerminologyReviewedSource,
  updateTerminologyCandidateKind,
  updateTerminologyPreferredVariant,
  updateTerminologyReviewedSource,
  updateTerminologyReviewDecision,
  updateTerminologyVariantClassification,
} from "@/core/terminology/review-state";
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

const CANDIDATE_KINDS: TerminologyCandidateKind[] = ["term", "phrase", "sentence-like"];
const VARIANT_CLASSIFICATIONS: TerminologyVariantClassification[] = [
  "form",
  "alternative",
  "forbidden",
];

function ManualVariantEditor({
  classifications,
  onClassify,
}: {
  classifications: Readonly<Record<string, TerminologyVariantClassification>>;
  onClassify: (value: string, classification: TerminologyVariantClassification | null) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [classification, setClassification] =
    useState<TerminologyVariantClassification>("alternative");

  const add = () => {
    if (!value.trim()) return;
    onClassify(value, classification);
    setValue("");
  };

  return (
    <div className="grid gap-2">
      <strong className="text-sm">{t("terminology.classifiedVariants")}</strong>
      {Object.keys(classifications).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(classifications).map(([classifiedValue, role]) => (
            <Button
              key={classifiedValue}
              size="sm"
              variant="secondary"
              title={t("terminology.removeClassification")}
              onClick={() => onClassify(classifiedValue, null)}
            >
              {classifiedValue} · {t(`terminology.variant.${role}`)} ×
            </Button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)_auto]">
        <input
          aria-label={t("terminology.manualVariant")}
          className="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
          placeholder={t("terminology.manualVariant")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <select
          aria-label={t("terminology.variantRole")}
          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          value={classification}
          onChange={(event) =>
            setClassification(event.target.value as TerminologyVariantClassification)
          }
        >
          {VARIANT_CLASSIFICATIONS.map((role) => (
            <option key={role} value={role}>
              {t(`terminology.variant.${role}`)}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={!value.trim()} onClick={add}>
          {t("terminology.addVariant")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t("terminology.manualVariantHint")}</p>
    </div>
  );
}

export function TerminologyReviewWorkspace({
  candidates,
  reviewState,
  onReviewStateChange,
}: {
  candidates: readonly TerminologyCandidate[];
  reviewState: TerminologyReviewState;
  onReviewStateChange: (state: TerminologyReviewState) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const { decisions, preferredVariants } = reviewState;

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
  const selectedCandidateKind = selectedCandidate
    ? (reviewState.candidateKinds[selectedCandidate.source] ?? null)
    : null;
  const selectedReviewedSource = selectedCandidate
    ? effectiveTerminologyReviewedSource(reviewState, selectedCandidate.source)
    : "";
  const selectedClassifications = selectedCandidate
    ? (reviewState.variantClassifications[selectedCandidate.source] ?? {})
    : {};
  const canAccept =
    selectedCandidate != null &&
    canAcceptTerminologyCandidate(
      reviewState,
      selectedCandidate.source,
      selectedCandidate.languages.map((language) => language.languageCode),
    );

  const setDecision = (decision: TerminologyReviewDecision) => {
    if (!selectedCandidate || (decision === "accepted" && !canAccept)) return;
    onReviewStateChange(
      updateTerminologyReviewDecision(reviewState, selectedCandidate.source, decision, canAccept),
    );
  };

  const setPreferredVariant = (languageCode: string, value: string) => {
    if (!selectedCandidate) return;
    onReviewStateChange(
      updateTerminologyPreferredVariant(reviewState, selectedCandidate.source, languageCode, value),
    );
  };

  const setCandidateKind = (kind: TerminologyCandidateKind | null) => {
    if (!selectedCandidate) return;
    onReviewStateChange(
      updateTerminologyCandidateKind(reviewState, selectedCandidate.source, kind),
    );
  };

  const setReviewedSource = (value: string) => {
    if (!selectedCandidate) return;
    onReviewStateChange(
      updateTerminologyReviewedSource(reviewState, selectedCandidate.source, value),
    );
  };

  const setVariantClassification = (
    languageCode: string,
    value: string,
    classification: TerminologyVariantClassification | null,
  ) => {
    if (!selectedCandidate) return;
    onReviewStateChange(
      updateTerminologyVariantClassification(
        reviewState,
        selectedCandidate.source,
        languageCode,
        value,
        classification,
      ),
    );
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
            const candidateKind = reviewState.candidateKinds[candidate.source];
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
                  {candidateKind && (
                    <Badge variant={candidateKind === "sentence-like" ? "destructive" : "outline"}>
                      {t(`terminology.kind.${candidateKind}`)}
                    </Badge>
                  )}
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

            <div className="border-border grid gap-3 rounded-lg border p-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{t("terminology.entrySource")}</span>
                <input
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  value={selectedReviewedSource}
                  onChange={(event) => setReviewedSource(event.target.value)}
                />
                <span className="text-muted-foreground text-xs">
                  {t("terminology.entrySourceHint")}
                </span>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{t("terminology.candidateKind")}</span>
                <select
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  value={selectedCandidateKind ?? ""}
                  onChange={(event) =>
                    setCandidateKind(
                      event.target.value ? (event.target.value as TerminologyCandidateKind) : null,
                    )
                  }
                >
                  <option value="">{t("terminology.candidateKindRequired")}</option>
                  {CANDIDATE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`terminology.kind.${kind}`)}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground text-xs">
                  {t("terminology.candidateKindHint")}
                </span>
              </label>
              {selectedCandidateKind === "sentence-like" && (
                <p className="text-destructive text-sm md:col-span-2">
                  {t("terminology.sentenceLikeWarning")}
                </p>
              )}
              {!canAccept && selectedCandidateKind !== "sentence-like" && (
                <p className="text-muted-foreground text-xs md:col-span-2">
                  {t("terminology.acceptRequirements")}
                </p>
              )}
            </div>

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
                const classifications = selectedClassifications[language.languageCode] ?? {};
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
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium">{t("terminology.preferredTranslation")}</span>
                      <input
                        aria-label={`${t("terminology.preferredTranslation")} · ${language.languageCode}`}
                        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                        value={preferred}
                        onChange={(event) =>
                          setPreferredVariant(language.languageCode, event.target.value)
                        }
                      />
                      <span className="text-muted-foreground text-xs">
                        {t("terminology.preferredTranslationHint")}
                      </span>
                    </label>
                    <div className="grid gap-2">
                      <div className="grid gap-1">
                        <strong className="text-sm">{t("terminology.observedVariants")}</strong>
                        <p className="text-muted-foreground text-xs">
                          {t("terminology.observedVariantsHint")}
                        </p>
                      </div>
                      {language.variants.map((variant) => (
                        <div
                          key={variant.value}
                          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)]"
                        >
                          <button
                            type="button"
                            className={cn(
                              "grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border px-3 py-2 text-start text-sm",
                              preferred === variant.value
                                ? "border-primary bg-muted"
                                : "bg-muted hover:border-border border-transparent",
                            )}
                            onClick={() =>
                              setPreferredVariant(language.languageCode, variant.value)
                            }
                          >
                            <span>{variant.value}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {variant.count} · {Math.round(variant.ratio * 100)}%
                            </span>
                          </button>
                          <select
                            aria-label={`${t("terminology.variantRole")} · ${variant.value}`}
                            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                            value={classifications[variant.value] ?? ""}
                            onChange={(event) =>
                              setVariantClassification(
                                language.languageCode,
                                variant.value,
                                event.target.value
                                  ? (event.target.value as TerminologyVariantClassification)
                                  : null,
                              )
                            }
                          >
                            <option value="">{t("terminology.variant.evidence")}</option>
                            {VARIANT_CLASSIFICATIONS.map((role) => (
                              <option key={role} value={role}>
                                {t(`terminology.variant.${role}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <ManualVariantEditor
                      classifications={classifications}
                      onClassify={(value, classification) =>
                        setVariantClassification(language.languageCode, value, classification)
                      }
                    />
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
