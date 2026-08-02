import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { GitCompareArrows } from "lucide-react";

import { useMediaQuery } from "@/hooks/use-media-query";

import { BarOptions } from "@/components/layout/BarOptions";
import { LIST_CLASS, VirtualList } from "@/components/layout/VirtualList";
import { Toolbar } from "@/components/layout/Toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
      className={cn(
        segment.kind === "delete" && "bg-warn/42 rounded-sm",
        segment.kind === "add" && "bg-success/40 rounded-sm",
      )}
    >
      {segment.text}
    </span>
  ));
}

const DIFF_ROW_HEIGHT = 20;
/** Equal lines kept either side of a change, so it is never shown bare. */
const DIFF_CONTEXT = 3;
const DIFF_CHARS_PER_LINE = 78; // one diff column at 12.5px monospace

const DIFF_LIST_CLASS = cn(
  LIST_CLASS,
  "px-0 pt-0 font-mono text-[12.5px] leading-normal ltr-isolate",
);

// Flex, not grid: each virtual row is its own layout context, and CSS grid's
// `1fr` still sized to min-content so gutters wandered on a phone. Fixed-width
// gutters + two equal `flex-1 min-w-0` panes stay aligned across rows without
// clipping the wrapped text.
const DIFF_ROW_CLASS = "flex w-full min-w-0";
const DIFF_GUTTER_CLASS = cn(
  "bg-gutter text-muted-foreground w-[46px] shrink-0 select-none px-2 py-0.5",
  "text-end tabular-nums whitespace-nowrap",
  "max-[720px]:w-[34px] max-[720px]:px-1",
);
const DIFF_PANE_CLASS = cn(
  "border-border-soft min-w-0 flex-1 border-s px-2.5 py-0.5",
  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
);

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
    <span className="ltr-isolate text-foreground font-mono text-xs">
      <Badge variant="secondary" className="text-warn bg-transparent px-1 font-mono">
        −{summary.deleted}
      </Badge>{" "}
      <Badge variant="secondary" className="text-primary bg-transparent px-1 font-mono">
        ~{summary.changed}
      </Badge>{" "}
      <Badge variant="secondary" className="text-success bg-transparent px-1 font-mono">
        +{summary.added}
      </Badge>{" "}
      {t("diff.stat", { total: Math.max(leftLines.length, rightLines.length) })}
      <span className="text-muted-foreground whitespace-nowrap max-[760px]:hidden">
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
      <Toolbar>
        {/* The compare tab's primary action keeps its place but yields width. */}
        <Button
          type="button"
          variant="secondary"
          className="max-[860px]:min-w-0 max-[860px]:flex-[0_1_auto] max-[860px]:overflow-hidden"
          onClick={() => inputRef.current?.click()}
        >
          {t("diff.loadFile")}
        </Button>
        <BarOptions>
          <Label className="flex items-center gap-2 text-xs" title={t("diff.onlyDiffTitle")}>
            <Switch
              size="sm"
              checked={workspace.diffOnly}
              onCheckedChange={(checked) => workspace.setDiffOnly(checked)}
            />
            <span>{t("diff.onlyDiff")}</span>
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label={t("diff.inlineMode")}
            value={workspace.diffMode}
            onValueChange={(value) => value && workspace.setDiffMode(value as "word" | "character")}
          >
            <ToggleGroupItem value="word">{t("diff.modeWords")}</ToggleGroupItem>
            <ToggleGroupItem value="character">{t("diff.modeCharacters")}</ToggleGroupItem>
          </ToggleGroup>
          {!compact && stats}
        </BarOptions>
        <div className="flex-1" />
      </Toolbar>

      {compact && stats && (
        <div className="bg-secondary no-scrollbar border-border flex-none [scrollbar-width:none] overflow-x-auto border-b px-3 py-[7px] whitespace-nowrap">
          {stats}
        </div>
      )}

      {!workspace.diffOther ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <Empty className="bg-card w-[min(560px,90%)] border-[1.5px] border-dashed px-[34px] py-11">
            <EmptyHeader className="max-w-none">
              <EmptyMedia
                variant="icon"
                className="bg-primary-soft text-primary mb-4 size-14 rounded-xl [&_svg:not([class*='size-'])]:size-[26px]"
                aria-hidden="true"
              >
                <GitCompareArrows />
              </EmptyMedia>
              <EmptyDescription
                className="text-[13.5px]"
                dangerouslySetInnerHTML={{ __html: t("diff.empty") }}
              />
            </EmptyHeader>
          </Empty>
        </div>
      ) : allRows.every((row) => row.kind === "equal") ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <Empty className="bg-card w-[min(560px,90%)] border-[1.5px] border-dashed px-[34px] py-11">
            <EmptyHeader>
              <EmptyTitle>{t("diff.identical")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <VirtualList
          className={DIFF_LIST_CLASS}
          items={rows}
          estimateSize={estimateSize}
          overscan={40}
          getKey={(_item, index) => index}
          header={
            <div
              className={cn(
                DIFF_ROW_CLASS,
                "bg-secondary text-foreground-faint border-border sticky top-0 z-[2] border-b text-[11px] tracking-[0.06em]",
              )}
            >
              <div className={cn(DIFF_GUTTER_CLASS, "bg-transparent py-1.5")}>
                {t("diff.headLine")}
              </div>
              <div className="ltr-isolate min-w-0 flex-1 truncate px-2.5 py-1.5">
                {workspace.diffOther.name}
              </div>
              <div
                className={cn(DIFF_GUTTER_CLASS, "border-border border-s bg-transparent py-1.5")}
              >
                {t("diff.headLine")}
              </div>
              <div className="min-w-0 flex-1 truncate px-2.5 py-1.5">{t("diff.headCurrent")}</div>
            </div>
          }
          renderItem={(item) => {
            if (item.type === "gap") {
              return (
                <div className={DIFF_ROW_CLASS}>
                  <div className="bg-diff-gap text-foreground-faint border-border-soft min-w-0 flex-1 border-b py-1 text-center text-[11px] tracking-[0.05em]">
                    {t("diff.gap", { n: item.n })}
                  </div>
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
                  <span className={cn(detail.statusChanged && "bg-warn/30 rounded-sm")}>
                    {parsed.prefix}
                  </span>
                  {detail.keyChanged ? renderSegments(detail.keyInline, side) : parsed.key}
                  {"="}
                  {detail.valueChanged ? renderSegments(detail.valueInline, side) : parsed.value}
                </>
              );
            };

            const leftChanged = row.kind === "delete" || row.kind === "change";
            const rightChanged = row.kind === "add" || row.kind === "change";

            return (
              <div className={cn(DIFF_ROW_CLASS, "border-border-soft border-b")}>
                <div className={cn(DIFF_GUTTER_CLASS, leftChanged && "bg-diff-del")}>
                  {row.leftIndex >= 0 ? row.leftIndex + 1 : ""}
                </div>
                <div
                  className={cn(
                    DIFF_PANE_CLASS,
                    "ltr-isolate",
                    row.kind === "equal" && "text-foreground/82",
                    leftChanged && "bg-diff-del",
                  )}
                >
                  {renderSide("left", left)}
                </div>
                <div className={cn(DIFF_GUTTER_CLASS, rightChanged && "bg-diff-add")}>
                  {row.rightIndex >= 0 ? row.rightIndex + 1 : ""}
                </div>
                <div
                  className={cn(
                    DIFF_PANE_CLASS,
                    "ltr-isolate",
                    row.kind === "equal" && "text-foreground/82",
                    rightChanged && "bg-diff-add",
                  )}
                >
                  {renderSide("right", right)}
                </div>
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
