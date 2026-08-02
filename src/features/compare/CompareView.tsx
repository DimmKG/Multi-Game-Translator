import { useCallback, useMemo, useRef, type ReactNode } from "react";

import { VirtualList } from "@/components/layout/VirtualList";

import { compareEntryPair, diffRows, summarizeRows } from "@/core/compare/token-aware-diff";
import type { DiffSegment } from "@/core/compare/token-aware-diff";
import { buildLangFile } from "@/core/lang/export";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

interface InlinePair {
  left: DiffSegment[];
  right: DiffSegment[];
}

function renderSegments(pair: InlinePair, side: "left" | "right"): ReactNode[] {
  return pair[side].map((segment, index) => (
    <span
      key={index}
      className={cn(segment.kind === "delete" && "di-del", segment.kind === "add" && "di-add")}
    >
      {segment.text}
    </span>
  ));
}

const DIFF_ROW_HEIGHT = 20;
const DIFF_CHARS_PER_LINE = 78; // one diff column at 12.5px monospace

export function CompareView() {
  const { t } = useI18n();
  const workspace = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);

  // Left column is the loaded comparison file, right column the working translation —
  // so "add" reads as "present in my translation", matching the original layout.
  const leftLines = useMemo(() => workspace.diffOther?.lines ?? [], [workspace.diffOther]);
  const rightLines = useMemo(
    () => buildLangFile(workspace.items, workspace.eol).split(/\r\n|\n/),
    [workspace.items, workspace.eol],
  );

  const allRows = useMemo(
    () => (leftLines.length ? diffRows(leftLines, rightLines) : []),
    [leftLines, rightLines],
  );

  /** Collapse long equal stretches into a single "⋯ n matching lines ⋯" marker. */
  const rows = useMemo(() => {
    if (!workspace.diffOnly) return allRows.map((row) => ({ type: "row" as const, row }));
    const out: Array<{ type: "row"; row: (typeof allRows)[number] } | { type: "gap"; n: number }> =
      [];
    let run = 0;
    for (const row of allRows) {
      if (row.kind === "equal") {
        run += 1;
        continue;
      }
      if (run > 0) {
        out.push({ type: "gap", n: run });
        run = 0;
      }
      out.push({ type: "row", row });
    }
    if (run > 0) out.push({ type: "gap", n: run });
    return out;
  }, [allRows, workspace.diffOnly]);

  // Stable identity — see the note in EditorView.
  const estimateSize = useCallback(
    (index: number) => {
      // Diff rows are single lines unless the text wraps in its column.
      const item = rows[index];
      if (!item || item.type === "gap") return DIFF_ROW_HEIGHT;
      const left = item.row.leftIndex >= 0 ? leftLines[item.row.leftIndex] : "";
      const right = item.row.rightIndex >= 0 ? rightLines[item.row.rightIndex] : "";
      const lines = Math.max(
        1,
        Math.ceil(Math.max(left.length, right.length) / DIFF_CHARS_PER_LINE),
      );
      return lines * DIFF_ROW_HEIGHT;
    },
    [rows, leftLines, rightLines],
  );

  const summary = useMemo(
    () => (leftLines.length ? summarizeRows(allRows, leftLines, rightLines) : null),
    [allRows, leftLines, rightLines],
  );

  return (
    <>
      <div className="diffbar">
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          {t("diff.loadFile")}
        </button>
        <span className="diffname ltr-isolate">
          {workspace.diffOther
            ? t("diff.fileInfo", {
                name: workspace.diffOther.name,
                n: workspace.diffOther.lines.length,
              })
            : ""}
        </span>
        <button
          type="button"
          className={cn("toggle", workspace.diffOnly && "on")}
          title={t("diff.onlyDiffTitle")}
          aria-pressed={workspace.diffOnly}
          onClick={() => workspace.setDiffOnly(!workspace.diffOnly)}
        >
          <span className="tk" />
          <span>{t("diff.onlyDiff")}</span>
        </button>
        <div className="diff-mode" role="group" aria-label={t("diff.inlineMode")}>
          <button
            type="button"
            className={cn("diff-mode-btn", workspace.diffMode === "word" && "on")}
            aria-pressed={workspace.diffMode === "word"}
            onClick={() => workspace.setDiffMode("word")}
          >
            {t("diff.modeWords")}
          </button>
          <button
            type="button"
            className={cn("diff-mode-btn", workspace.diffMode === "character" && "on")}
            aria-pressed={workspace.diffMode === "character"}
            onClick={() => workspace.setDiffMode("character")}
          >
            {t("diff.modeCharacters")}
          </button>
        </div>
        <div className="sp" />
        {summary && (
          <span className="diffstat ltr-isolate">
            <span className="del">−{summary.deleted}</span>{" "}
            <span className="chg">~{summary.changed}</span>{" "}
            <span className="add">+{summary.added}</span>{" "}
            {t("diff.stat", { total: Math.max(leftLines.length, rightLines.length) })}
            <span className="diff-detail">
              {" · "}
              {t("diff.changedKeys", { n: summary.changedKeys })}
              {" · "}
              {t("diff.changedValues", { n: summary.changedValues })}
              {" · "}
              {t("diff.prefixOnly", { n: summary.prefixOnly })}
            </span>
          </span>
        )}
      </div>

      {!workspace.diffOther ? (
        <div className="difflist">
          <div className="empty-state" dangerouslySetInnerHTML={{ __html: t("diff.empty") }} />
        </div>
      ) : allRows.every((row) => row.kind === "equal") ? (
        <div className="difflist">
          <div className="empty-state">{t("diff.identical")}</div>
        </div>
      ) : (
        <VirtualList
          className="difflist"
          items={rows}
          estimateSize={estimateSize}
          overscan={40}
          getKey={(_item, index) => index}
          header={
            <div className="dhead">
              <div>{t("diff.headLine")}</div>
              <div className="ltr-isolate">{workspace.diffOther.name}</div>
              <div className="h2">{t("diff.headLine")}</div>
              <div>{t("diff.headCurrent")}</div>
            </div>
          }
          renderItem={(item) => {
            if (item.type === "gap") {
              return (
                <div className="drow">
                  <div className="dgap">{t("diff.gap", { n: item.n })}</div>
                </div>
              );
            }
            const { row } = item;
            const left = row.leftIndex >= 0 ? leftLines[row.leftIndex] : "";
            const right = row.rightIndex >= 0 ? rightLines[row.rightIndex] : "";
            const detail =
              row.kind === "change" && row.leftIndex >= 0 && row.rightIndex >= 0
                ? compareEntryPair(left, right, workspace.diffMode)
                : null;

            // Highlight only the differing run; the status prefix and key stay literal.
            const renderSide = (side: "left" | "right", raw: string) => {
              if (!detail) return raw;
              if (detail.type === "text") return renderSegments(detail.inline, side);
              const parsed = side === "left" ? detail.left : detail.right;
              if (parsed.type !== "entry") return raw;
              return (
                <>
                  <span className={cn(detail.statusChanged && "diff-prefix")}>{parsed.prefix}</span>
                  {detail.keyChanged ? renderSegments(detail.keyInline, side) : parsed.key}
                  {"="}
                  {detail.valueChanged ? renderSegments(detail.valueInline, side) : parsed.value}
                </>
              );
            };

            return (
              <div
                className={cn(
                  "drow",
                  row.kind === "equal" && "eq",
                  row.kind === "add" && "add",
                  row.kind === "delete" && "del",
                  row.kind === "change" && "chg",
                  row.prefixOnly && "prefix-only",
                )}
              >
                <div className="dnum dnum-l">{row.leftIndex >= 0 ? row.leftIndex + 1 : ""}</div>
                <div className="dtxt txt-l ltr-isolate">{renderSide("left", left)}</div>
                <div className="dnum dnum-r">{row.rightIndex >= 0 ? row.rightIndex + 1 : ""}</div>
                <div className="dtxt txt-r ltr-isolate">{renderSide("right", right)}</div>
              </div>
            );
          }}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".lang,.txt"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void workspace.loadDiffFile(file);
          event.target.value = "";
        }}
      />
    </>
  );
}
