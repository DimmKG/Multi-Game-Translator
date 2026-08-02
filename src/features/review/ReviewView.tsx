import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BarOptions } from "@/components/layout/BarOptions";
import { VirtualList } from "@/components/layout/VirtualList";
import { Textarea } from "@/components/ui/textarea";

import type { ReviewFilter } from "@/core/lang/markers";
import { statusOf, type TranslationEntry } from "@/core/lang/status";
import { missingTokens, tokenKind } from "@/core/tokens/protected";
import { fixWhitespace, scanWhitespace } from "@/core/tokens/whitespace";
import { useI18n } from "@/features/i18n/I18nProvider";
import { requestEditorScroll } from "@/features/editor/scroll-requests";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    setStickyIds(new Set());
  }, [workspace.view]);

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
      if (statusOf(entry) === "same") same += 1;
      if (
        missingTokens(entry).length > 0 ||
        scanWhitespace(entry).any ||
        workspace.terminologyIssuesFor(entry).length > 0
      ) {
        issues += 1;
      }
    }
    return { all: touched.length, mt, issues, same };
  }, [touched, workspace]);

  const rows = useMemo(() => {
    const query = workspace.reviewQuery.trim().toLowerCase();
    const matched = touched.filter((entry) => {
      const hasIssues =
        missingTokens(entry).length > 0 ||
        scanWhitespace(entry).any ||
        workspace.terminologyIssuesFor(entry).length > 0;
      if (workspace.reviewFilter === "mt" && !entry.mtDraft) return false;
      if (workspace.reviewFilter === "issues" && !hasIssues) return false;
      if (workspace.reviewFilter === "same" && statusOf(entry) !== "same") return false;
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
  }, [touched, workspace, stickyIds]);

  // Stable identity — see the note in EditorView.
  const estimateSize = useCallback(
    (index: number) => {
      // Three columns side by side, so the tallest of source/translation wins.
      const entry = rows[index];
      if (!entry) return REVIEW_ROW_CHROME;
      const reference = entry.ref ?? (entry.wasMissing ? entry.english : null);
      const lines = Math.max(
        reference ? Math.ceil(reference.length / REVIEW_CHARS_PER_LINE) : 1,
        Math.ceil((entry.value.length || 1) / REVIEW_CHARS_PER_LINE),
      );
      return REVIEW_ROW_CHROME + lines * 20;
    },
    [rows],
  );

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
      <div className="reviewbar">
        <div className="search" style={{ maxWidth: 340 }}>
          <Search className="ic" size={14} aria-hidden="true" />
          <input
            type="text"
            autoComplete="off"
            placeholder={t("review.searchPh")}
            value={workspace.reviewQuery}
            onChange={(event) => workspace.setReviewQuery(event.target.value)}
          />
        </div>
        <BarOptions>
          <div className="rchips">
            {chips.map((chip) => (
              <button
                type="button"
                key={chip.id}
                className={cn("rchip", workspace.reviewFilter === chip.id && "on")}
                disabled={chip.disabled}
                onClick={() => workspace.setReviewFilter(chip.id)}
              >
                <span>{chip.label}</span>
                <span className="n">{chip.n}</span>
              </button>
            ))}
          </div>
          <span className="hint">{t("review.scopeHint")}</span>
        </BarOptions>
        <div className="sp" />
      </div>

      <VirtualList
        className="reviewlist"
        items={rows}
        overscan={14}
        estimateSize={estimateSize}
        getKey={(entry) => entry.id}
        empty={
          <div className="empty-state">
            {touched.length === 0 ? t("review.emptyNothing") : t("review.emptyCategory")}
          </div>
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
              className={cn("rrow", flagged && "flag", !flagged && entry.mtDraft && "mt")}
              onFocusCapture={() => pinEntry(entry.id)}
            >
              <div className="rmeta">
                <button
                  type="button"
                  className="rkey ltr-isolate"
                  title={t("card.copyKey")}
                  onClick={() => void navigator.clipboard?.writeText(entry.key)}
                >
                  {entry.key}
                </button>
                <div className="rflags">
                  {entry.mtDraft && <span className="rflag mt">{t("badge.mt")}</span>}
                  {status === "missing" && (
                    <span className="rflag miss">{t("rflag.notTranslated")}</span>
                  )}
                  {status === "same" && <span className="rflag same">{t("rflag.sameRef")}</span>}
                  {missing.length > 0 && (
                    <span className="rflag miss">
                      {t("rflag.token", { list: missing.join(" ") })}
                    </span>
                  )}
                  {whitespace.any && (
                    <span className="rflag ws">
                      {t("rflag.ws", { list: whitespaceLabels(entry, t).join(", ") })}
                    </span>
                  )}
                  {terminology.length > 0 && (
                    <span className="rflag miss">
                      {t("terminology.reviewBadge", { n: terminology.length })}
                    </span>
                  )}
                </div>
              </div>

              <div className="rcol">
                <span className="rlabel">{t("review.referenceLabel")}</span>
                <div className={cn("ren ltr-isolate", reference == null && "empty-ref")}>
                  {reference ?? t("review.noRef")}
                </div>
              </div>

              <div className="rcol rru">
                <span className="rlabel">{t("review.trLabel")}</span>
                <div className="tawrap rv">
                  <Textarea
                    value={entry.value}
                    spellCheck={workspace.spellcheck}
                    onChange={(event) => workspace.updateEntryValue(entry.id, event.target.value)}
                  />
                </div>
                {missing.length > 0 && (
                  <div className="rmiss">
                    {missing.map((token) => (
                      <button
                        type="button"
                        key={token}
                        className={cn("chip miss", tokenKind(token))}
                        title={t("tokens.insertMissing")}
                        onClick={() =>
                          workspace.updateEntryValue(entry.id, `${entry.value}${token}`)
                        }
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="ractions">
                <button
                  type="button"
                  className="rbtn"
                  title={t("review.editTitle")}
                  onClick={() => {
                    workspace.setView("editor");
                    workspace.setFilter("all");
                    requestEditorScroll({ type: "key", key: entry.key });
                  }}
                >
                  {t("review.edit")}
                </button>
                {entry.mtDraft && (
                  <button
                    type="button"
                    className="rbtn ok"
                    title={t("review.checkedTitle")}
                    onClick={() => workspace.updateEntryValue(entry.id, entry.value)}
                  >
                    {t("review.checked")}
                  </button>
                )}
                {whitespace.any && (
                  <button
                    type="button"
                    className="rbtn"
                    title={t("review.wsFixTitle", {
                      list: whitespaceLabels(entry, t).join(", "),
                    })}
                    onClick={() => workspace.updateEntryValue(entry.id, fixWhitespace(entry))}
                  >
                    {t("review.wsFix")}
                  </button>
                )}
              </div>
            </div>
          );
        }}
      />
    </>
  );
}
