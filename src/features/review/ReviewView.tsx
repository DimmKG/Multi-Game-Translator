// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BarOptions } from "@/components/layout/BarOptions";
import { Toolbar, ToolbarHint, ToolbarSearch } from "@/components/layout/Toolbar";
import { LIST_CLASS, VirtualList } from "@/components/layout/VirtualList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { REVIEW_TEXTAREA_CLASS } from "@/features/editor/card-classes";

import type { ReviewFilter } from "@/core/lang/markers";
import { statusOf, type TranslationEntry } from "@/core/lang/status";
import { missingTokens } from "@/core/tokens/protected";
import { fixWhitespace, scanWhitespace } from "@/core/tokens/whitespace";
import { useI18n } from "@/features/i18n/I18nProvider";
import { requestEditorScroll } from "@/features/editor/scroll-requests";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

/** Key and flags, source, translation, actions — one column each until 920px. */
const ROW_CLASS = cn(
  "bg-card border-border-soft mb-2 grid items-start gap-3.5 rounded-[9px] border px-3 py-[11px]",
  "grid-cols-[170px_1fr_1fr_92px] border-s-[3px]",
  "max-[920px]:grid-cols-1",
);

const FLAG_CLASS = "rounded px-1.5 py-0.5 font-mono text-[10px] tracking-[0.03em]";
const WARN_FLAG = "bg-warn-soft text-warn";
const COLUMN_LABEL_CLASS =
  "text-foreground-faint mb-1 block text-[10px] tracking-[0.14em] uppercase";

const REVIEW_ROW_CHROME = 92;
const REVIEW_CHARS_PER_LINE = 46; // each of the two text columns is roughly a third of the row

function whitespaceLabels(entry: TranslationEntry, t: (key: string) => string) {
  const flags = scanWhitespace(entry);
  const labels: string[] = [];
  if (flags.lead) labels.push(t("ws.lead"));
  if (flags.trail) labels.push(t("ws.trail"));
  if (flags.dbl) labels.push(t("ws.dbl"));
  if (flags.tab) labels.push(t("ws.tab"));
  if (flags.nbsp) labels.push(t("ws.nbsp"));
  return labels;
}

export function ReviewView() {
  const { t } = useI18n();
  const workspace = useWorkspace();
  const [stickyIds, setStickyIds] = useState<ReadonlySet<number>>(() => new Set());

  const pinEntry = useCallback((entryId: number) => {
    setStickyIds((current) => {
      if (current.has(entryId)) return current;
      const next = new Set(current);
      next.add(entryId);
      return next;
    });
  }, []);

  // Same rule as the editor: changing the mode or the chip retires a pin,
  // typing in the search box does not.
  useEffect(() => {
    setStickyIds(new Set());
  }, [workspace.view, workspace.reviewFilter]);

  const touched = useMemo(
    () =>
      workspace.items.filter(
        (item): item is TranslationEntry => item.type === "entry" && item.touched,
      ),
    [workspace.items],
  );

  const counts = useMemo(() => {
    let mt = 0;
    let issues = 0;
    let same = 0;
    for (const entry of touched) {
      if (entry.mtDraft) mt += 1;
      const indexed = workspace.rowIndexes.get(entry.id);
      if (indexed?.status === "same") same += 1;
      if (indexed?.tokenIssue || indexed?.wsIssue || indexed?.glossaryIssue) issues += 1;
    }
    return { all: touched.length, mt, issues, same };
  }, [touched, workspace.rowIndexes]);

  const rows = useMemo(() => {
    const query = workspace.reviewQuery.trim().toLowerCase();
    const matched = touched.filter((entry) => {
      const indexed = workspace.rowIndexes.get(entry.id);
      const hasIssues = !!(indexed?.tokenIssue || indexed?.wsIssue || indexed?.glossaryIssue);
      if (workspace.reviewFilter === "mt" && !entry.mtDraft) return false;
      if (workspace.reviewFilter === "issues" && !hasIssues) return false;
      if (workspace.reviewFilter === "same" && indexed?.status !== "same") return false;
      if (query) {
        const haystack = `${entry.key}\n${entry.value}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    if (!stickyIds.size) return matched;
    const seen = new Set(matched.map((entry) => entry.id));
    const keep = new Set([...seen, ...stickyIds]);
    return touched.filter((entry) => keep.has(entry.id));
  }, [touched, workspace.reviewFilter, workspace.reviewQuery, workspace.rowIndexes, stickyIds]);

  // Stable identity — see the note in EditorView.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const estimateSize = useCallback((index: number) => {
    // Three columns side by side, so the tallest of source/translation wins.
    const entry = rowsRef.current[index];
    if (!entry) return REVIEW_ROW_CHROME;
    const reference = entry.ref ?? (entry.wasMissing ? entry.english : null);
    const lines = Math.max(
      reference ? Math.ceil(reference.length / REVIEW_CHARS_PER_LINE) : 1,
      Math.ceil((entry.value.length || 1) / REVIEW_CHARS_PER_LINE),
    );
    return REVIEW_ROW_CHROME + lines * 20;
  }, []);

  const chips: Array<{ id: ReviewFilter; label: string; n: number; disabled?: boolean }> = [
    { id: "all", label: t("review.all"), n: counts.all },
    { id: "mt", label: t("review.mt"), n: counts.mt },
    { id: "issues", label: t("review.issues"), n: counts.issues },
    {
      id: "same",
      label: workspace.referenceAvailable ? t("review.sameEng") : t("reference.notLoaded"),
      n: counts.same,
      disabled: !workspace.referenceAvailable,
    },
  ];

  return (
    <>
      <Toolbar>
        <ToolbarSearch
          className="max-w-[340px]"
          placeholder={t("review.searchPh")}
          value={workspace.reviewQuery}
          onChange={(event) => workspace.setReviewQuery(event.target.value)}
        />
        <BarOptions>
          <ToggleGroup
            type="single"
            variant="outline"
            value={workspace.reviewFilter}
            onValueChange={(value) => value && workspace.setReviewFilter(value as ReviewFilter)}
          >
            {chips.map((chip) => (
              <ToggleGroupItem key={chip.id} value={chip.id} disabled={chip.disabled}>
                <span>{chip.label}</span>
                <Badge variant="secondary" className="font-mono">
                  {chip.n}
                </Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToolbarHint>{t("review.scopeHint")}</ToolbarHint>
        </BarOptions>
        <span className="flex-1" />
      </Toolbar>

      <VirtualList
        key={workspace.listRevision}
        className={LIST_CLASS}
        items={rows}
        overscan={14}
        estimateSize={estimateSize}
        getKey={(entry) => entry.id}
        empty={
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyDescription>
                {touched.length === 0 ? t("review.emptyNothing") : t("review.emptyCategory")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
        renderItem={(entry) => {
          const missing = missingTokens(entry);
          const whitespace = scanWhitespace(entry);
          const terminology = workspace.terminologyIssuesFor(entry);
          const status = statusOf(entry);
          const flagged = missing.length > 0 || whitespace.any || terminology.length > 0;
          const reference = entry.ref ?? (entry.wasMissing ? entry.english : null);

          return (
            <div
              // use-keyboard-inset finds the focused row by this slot.
              data-slot="review-row"
              className={cn(
                ROW_CLASS,
                flagged ? "border-s-warn" : entry.mtDraft ? "border-s-mt-ink" : "border-s-success",
              )}
              onFocusCapture={() => pinEntry(entry.id)}
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <button
                  type="button"
                  className={cn(
                    "bg-background ltr-isolate cursor-pointer rounded-md border px-2 py-[3px]",
                    "text-start font-mono text-[11.5px] break-all",
                    "hover:border-primary hover:text-primary",
                  )}
                  title={t("card.copyKey")}
                  onClick={() => void navigator.clipboard?.writeText(entry.key)}
                >
                  {entry.key}
                </button>
                <div className="flex flex-wrap gap-1">
                  {entry.mtDraft && (
                    <span className={cn(FLAG_CLASS, "bg-mt-soft text-mt-ink")}>
                      {t("badge.mt")}
                    </span>
                  )}
                  {status === "missing" && (
                    <span className={cn(FLAG_CLASS, WARN_FLAG)}>{t("rflag.notTranslated")}</span>
                  )}
                  {status === "same" && (
                    <span className={cn(FLAG_CLASS, "bg-same-soft text-same")}>
                      {t("rflag.sameRef")}
                    </span>
                  )}
                  {missing.length > 0 && (
                    <span className={cn(FLAG_CLASS, WARN_FLAG)}>
                      {t("rflag.token", { list: missing.join(" ") })}
                    </span>
                  )}
                  {whitespace.any && (
                    <span className={cn(FLAG_CLASS, WARN_FLAG)}>
                      {t("rflag.ws", { list: whitespaceLabels(entry, t).join(", ") })}
                    </span>
                  )}
                  {terminology.length > 0 && (
                    <span className={cn(FLAG_CLASS, WARN_FLAG)}>
                      {t("terminology.reviewBadge", { n: terminology.length })}
                    </span>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <span className={COLUMN_LABEL_CLASS}>{t("review.referenceLabel")}</span>
                <div
                  className={cn(
                    "bg-background border-border-soft ltr-isolate rounded-[7px] border px-2.5 py-2",
                    "text-[13px] leading-[1.55] break-words whitespace-pre-wrap",
                    reference == null && "text-foreground-faint italic",
                  )}
                >
                  {reference ?? t("review.noRef")}
                </div>
              </div>

              <div className="min-w-0">
                <span className={COLUMN_LABEL_CLASS}>{t("review.trLabel")}</span>
                <Textarea
                  className={REVIEW_TEXTAREA_CLASS}
                  value={entry.value}
                  spellCheck={workspace.spellcheck}
                  onChange={(event) => workspace.updateEntryValue(entry.id, event.target.value)}
                />
                {missing.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {missing.map((token) => (
                      <Button
                        type="button"
                        key={token}
                        variant="outline"
                        size="xs"
                        className="border-warn bg-warn-soft text-warn hover:bg-warn-soft/70 font-mono"
                        title={t("tokens.insertMissing")}
                        onClick={() =>
                          workspace.updateEntryValue(entry.id, `${entry.value}${token}`)
                        }
                      >
                        ⚠ {token}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* A column of actions beside the row, a row of them once it stacks. */}
              <div className="flex flex-col gap-1.5 max-[920px]:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hover:border-primary hover:text-primary"
                  title={t("review.editTitle")}
                  onClick={() => {
                    workspace.setView("editor");
                    workspace.setFilter("all");
                    requestEditorScroll({ type: "key", key: entry.key });
                  }}
                >
                  {t("review.edit")}
                </Button>
                {entry.mtDraft && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hover:border-success hover:text-success"
                    title={t("review.checkedTitle")}
                    onClick={() => workspace.updateEntryValue(entry.id, entry.value)}
                  >
                    {t("review.checked")}
                  </Button>
                )}
                {whitespace.any && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hover:border-primary hover:text-primary"
                    title={t("review.wsFixTitle", {
                      list: whitespaceLabels(entry, t).join(", "),
                    })}
                    onClick={() => workspace.updateEntryValue(entry.id, fixWhitespace(entry))}
                  >
                    {t("review.wsFix")}
                  </Button>
                )}
              </div>
            </div>
          );
        }}
      />
    </>
  );
}
