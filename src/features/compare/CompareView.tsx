import { useCallback, useMemo, useRef, type ReactNode } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

import { BarOptions } from "@/components/layout/BarOptions";
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
/** Equal lines kept either side of a change, so it is never shown bare. */
const DIFF_CONTEXT = 3;
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

  /**
   * Collapses long equal stretches, keeping a few lines either side of every
   * change so you can see what it sits between. Short runs are left alone —
   * hiding two lines to save two lines helps nobody.
   */
  const rows = useMemo(() => {
    if (!workspace.diffOnly) return allRows.map((row) => ({ type: "row" as const, row }));

    type Row = (typeof allRows)[number];
    const out: Array<{ type: "row"; row: Row } | { type: "gap"; n: number }> = [];
    let run: Row[] = [];
    let afterChange = false;

    const flushRun = (isTail: boolean) => {
      if (!run.length) return;
      const lead = afterChange ? Math.min(DIFF_CONTEXT, run.length) : 0;
      const trail = isTail ? 0 : Math.min(DIFF_CONTEXT, run.length - lead);
      if (lead + trail >= run.length) {
        for (const row of run) out.push({ type: "row", row });
      } else {
        for (let i = 0; i < lead; i++) out.push({ type: "row", row: run[i] });
        out.push({ type: "gap", n: run.length - lead - trail });
        for (let i = run.length - trail; i < run.length; i++)
          out.push({ type: "row", row: run[i] });
      }
      run = [];
    };

    for (const row of allRows) {
      if (row.kind === "equal") {
        run.push(row);
        continue;
      }
      flushRun(false);
      out.push({ type: "row", row });
      afterChange = true;
    }
    flushRun(true);
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

  // Worth glancing at while reading the diff, so on a phone it gets its own
  // strip under the bar rather than hiding behind the options button.
  const compact = useMediaQuery("(max-width: 860px)");
  const stats = summary && (
    <span className="diffstat ltr-isolate">
      <span className="del">−{summary.deleted}</span>{" "}
      <span className="chg">~{summary.changed}</span> <span className="add">+{summary.added}</span>{" "}
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
  );

  return (
    <>
      <div className="diffbar">
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          {t("diff.loadFile")}
        </button>
        <BarOptions>
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
          {!compact && stats}
        </BarOptions>
        <div className="sp" />
      </div>

      {compact && stats && <div className="diffstat-row">{stats}</div>}

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
