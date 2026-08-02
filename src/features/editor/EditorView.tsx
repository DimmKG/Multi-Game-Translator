import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookA,
  CircleCheck,
  CircleDashed,
  Equal,
  List,
  Pilcrow,
  Search,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { BarOptions } from "@/components/layout/BarOptions";
import { VirtualList, type VirtualListApi } from "@/components/layout/VirtualList";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import {
  calibrateCardMetrics,
  CardHeightCache,
  SECTION_HEAD_HEIGHT,
  type CardMetrics,
} from "@/features/editor/card-metrics";

import type { FilterMode } from "@/core/lang/markers";
import { statusOf, type TranslationEntry } from "@/core/lang/status";
import { metadataGuidanceFor } from "@/core/metadata/guidance";
import { missingTokens, tokenKind, tokensOf } from "@/core/tokens/protected";
import { fixWhitespace, scanWhitespace } from "@/core/tokens/whitespace";
import { useI18n } from "@/features/i18n/I18nProvider";
import {
  clearPendingScroll,
  requestEditorScroll,
  subscribeToScrollRequests,
  takePendingScroll,
} from "@/features/editor/scroll-requests";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

/** Used only until the first calibration lands, so it is never seen in practice. */
const FALLBACK_CARD_HEIGHT = 168;

const STATUS_BADGE: Record<string, { className: string; labelKey: string }> = {
  missing: { className: "b-missing", labelKey: "badge.missing" },
  done: { className: "b-done", labelKey: "badge.done" },
  same: { className: "b-same", labelKey: "badge.same" },
};

/** `[tile]` -> `tile`; the parser keeps the brackets, the UI does not show them. */
function sectionLabel(name: string) {
  return name.replace(/^\[|\]$/g, "");
}

/** Splits source text into plain runs and coloured protected tokens. */
function renderTokenized(text: string): ReactNode[] {
  const tokens = tokensOf(text);
  if (!tokens.length) return [text];
  const nodes: ReactNode[] = [];
  let rest = text;
  let key = 0;
  for (const token of tokens) {
    const index = rest.indexOf(token);
    if (index === -1) continue;
    if (index > 0) nodes.push(rest.slice(0, index));
    nodes.push(
      <span key={`t${key++}`} className={`t-${tokenKind(token)}`}>
        {token}
      </span>,
    );
    rest = rest.slice(index + token.length);
  }
  if (rest) nodes.push(rest);
  return nodes;
}

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

const EntryCard = memo(function EntryCard({
  entry,
  onPin,
}: {
  entry: TranslationEntry;
  onPin: (entryId: number) => void;
}) {
  const { t } = useI18n();
  const workspace = useWorkspace();
  const status = statusOf(entry);
  const missing = missingTokens(entry);
  const whitespace = scanWhitespace(entry);
  const guidance = metadataGuidanceFor(entry);
  const terminology = workspace.terminologyIssuesFor(entry);
  const reference = entry.ref ?? (entry.wasMissing ? entry.english : null);
  const badge = STATUS_BADGE[status];

  return (
    <article
      className={cn("card", `st-${status}`)}
      data-key={entry.key}
      onFocusCapture={() => onPin(entry.id)}
    >
      <div className="row1">
        <button
          type="button"
          className="key ltr-isolate"
          title={t("card.copyKey")}
          onClick={() => void navigator.clipboard?.writeText(entry.key)}
        >
          {entry.key}
        </button>
        <Badge className={cn("entry-badge", badge.className)}>{t(badge.labelKey)}</Badge>
        {entry.mtDraft && <Badge className="entry-badge b-mt">{t("badge.mt")}</Badge>}
        {whitespace.any && <Badge className="entry-badge b-ws">{t("filter.ws")}</Badge>}
        <span className="spacer" />
      </div>

      {guidance && <div className="guide">ⓘ {t(guidance.messageKey)}</div>}

      {reference != null && (
        <div className="orig">
          <span className="olabel">{t("card.referenceText")}</span>
          <span className="ltr-isolate">{renderTokenized(reference)}</span>
        </div>
      )}

      <div className="tawrap">
        <Textarea
          value={entry.value}
          spellCheck={workspace.spellcheck}
          onChange={(event) => workspace.updateEntryValue(entry.id, event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              const entries = workspace.filteredEntries;
              const index = entries.findIndex((item) => item.id === entry.id);
              const next = entries.slice(index + 1).find((item) => statusOf(item) === "missing");
              if (next) requestEditorScroll({ type: "key", key: next.key });
            }
          }}
        />
      </div>

      <div className="row3">
        {missing.length > 0 && <span className="toklead">{t("tokens.label")}</span>}
        {missing.map((token) => (
          <button
            type="button"
            key={token}
            className={cn("chip miss", tokenKind(token))}
            title={t("tokens.insertMissing")}
            onClick={() => workspace.updateEntryValue(entry.id, `${entry.value}${token}`)}
          >
            {token}
          </button>
        ))}
        {whitespace.any && (
          <button
            type="button"
            className="chip wsfix"
            title={t("review.wsFixTitle", { list: whitespaceLabels(entry, t).join(", ") })}
            onClick={() => workspace.updateEntryValue(entry.id, fixWhitespace(entry))}
          >
            {t("review.wsFix")}
          </button>
        )}
        <button
          type="button"
          className="chip mt"
          title={t("mt.btnTitle")}
          disabled={!workspace.targetLanguage}
          onClick={() => void workspace.translateEntry(entry.id)}
        >
          {t("mt.btn")}
        </button>
        {entry.ref != null && (
          <button
            type="button"
            className={cn("samebtn", entry.markedSame && "on")}
            title={t("same.title")}
            onClick={() => workspace.toggleMarkedSame(entry.id)}
          >
            {t(entry.markedSame ? "same.on" : "same.off")}
          </button>
        )}
      </div>

      {terminology.map((issue, index) => (
        <div className="warnline" key={`${issue.type}-${index}`}>
          <TriangleAlert size={13} aria-hidden="true" />
          {issue.type === "forbidden"
            ? t("terminology.forbidden", {
                found: issue.found ?? issue.source,
                preferred: issue.preferred,
              })
            : t("terminology.missing", { source: issue.source, preferred: issue.preferred })}
        </div>
      ))}
    </article>
  );
});

/** Filter rail + section jump list. Rendered beside the tab strip, editor view only. */
export function EditorSidebar() {
  const { t } = useI18n();
  const workspace = useWorkspace();
  const { setOpenMobile } = useSidebar();

  const entries = useMemo(
    () => workspace.items.filter((item): item is TranslationEntry => item.type === "entry"),
    [workspace.items],
  );

  const filters: Array<{
    id: FilterMode;
    label: string;
    count: number | string;
    icon: LucideIcon;
    tint: string;
    disabled?: boolean;
    warn?: boolean;
    title?: string;
  }> = useMemo(() => {
    const count = (predicate: (entry: TranslationEntry) => boolean) =>
      entries.filter(predicate).length;
    return [
      {
        id: "missing",
        label: t("filter.missing"),
        count: count((entry) => statusOf(entry) === "missing"),
        icon: CircleDashed,
        tint: "text-primary",
      },
      {
        id: "done",
        label: t("filter.done"),
        count: count((entry) => statusOf(entry) === "done"),
        icon: CircleCheck,
        tint: "text-success",
      },
      {
        id: "same",
        label: t("filter.same"),
        count: workspace.referenceAvailable ? count((entry) => statusOf(entry) === "same") : "—",
        icon: Equal,
        tint: "text-same",
        disabled: !workspace.referenceAvailable,
        title: workspace.referenceAvailable ? undefined : t("reference.notLoaded"),
      },
      {
        id: "all",
        label: t("filter.all"),
        count: entries.length,
        icon: List,
        tint: "text-foreground-faint",
      },
      {
        id: "ws",
        label: t("filter.ws"),
        count: workspace.whitespaceIssueCount,
        icon: Pilcrow,
        tint: "text-warn",
        warn: true,
        title: t("filter.wsTitle"),
      },
    ];
  }, [entries, t, workspace.referenceAvailable, workspace.whitespaceIssueCount]);

  const terminologyCount = useMemo(
    () => entries.filter((entry) => workspace.terminologyIssuesFor(entry).length > 0).length,
    [entries, workspace],
  );

  const sections = useMemo(() => {
    const list: Array<{ name: string; count: number }> = [];
    let current: { name: string; count: number } | null = null;
    for (const item of workspace.items) {
      if (item.type === "section") {
        current = { name: item.name, count: 0 };
        list.push(current);
      } else if (item.type === "entry" && current) {
        current.count += 1;
      }
    }
    return list;
  }, [workspace.items]);

  return (
    // Below 860px `Sidebar` renders itself as a Sheet — see use-mobile.
    <Sidebar collapsible="icon">
      {/* Filters stay put; only the section list scrolls, so they live in the
          non-scrolling header rather than in SidebarContent. */}
      <SidebarHeader className="p-0">
        <SidebarGroup>
          <SidebarMenu>
            {filters.map((filter) => {
              const active = workspace.filter === filter.id && !workspace.terminologyFilterActive;
              return (
                <SidebarMenuItem key={filter.id}>
                  <SidebarMenuButton
                    isActive={active}
                    disabled={filter.disabled}
                    title={filter.title}
                    tooltip={`${filter.label} · ${filter.count}`}
                    onClick={() => {
                      workspace.setTerminologyFilterActive(false);
                      workspace.setFilter(filter.id);
                      setOpenMobile(false);
                    }}
                  >
                    <filter.icon className={filter.tint} aria-hidden="true" />
                    <span className="group-data-[collapsible=icon]:hidden">{filter.label}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge
                    className={cn(
                      "font-mono",
                      filter.warn ? "text-warn" : active && "text-primary",
                    )}
                  >
                    {filter.count}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              );
            })}
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={workspace.terminologyFilterActive}
                title={t("terminology.filterTitle")}
                tooltip={`${t("terminology.filter")} · ${terminologyCount}`}
                onClick={() => {
                  workspace.setTerminologyFilterActive(!workspace.terminologyFilterActive);
                  setOpenMobile(false);
                }}
              >
                <BookA className="text-warn" aria-hidden="true" />
                <span className="group-data-[collapsible=icon]:hidden">
                  {t("terminology.filter")}
                </span>
              </SidebarMenuButton>
              <SidebarMenuBadge className="text-warn font-mono">
                {terminologyCount}
              </SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarSeparator className="mx-0 group-data-[collapsible=icon]:hidden" />

      <SidebarContent>
        {/* Section names have no icon to shrink to, and a 48px rail cannot show
            enough of one to be worth keeping. The whole list stands down. */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-[10px] tracking-[0.16em] uppercase">
            {t("side.sections")}
          </SidebarGroupLabel>
          <SidebarMenu>
            {sections.map((section) => (
              <SidebarMenuItem key={section.name}>
                <SidebarMenuButton
                  size="sm"
                  className="font-mono"
                  tooltip={sectionLabel(section.name)}
                  onClick={() => {
                    setOpenMobile(false);
                    requestEditorScroll({ type: "section", name: section.name });
                  }}
                >
                  <span className="ltr-isolate">{sectionLabel(section.name)}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="font-mono">{section.count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

export function EditorView() {
  const { t } = useI18n();
  const workspace = useWorkspace();
  // Keep cards that were opened for editing in the list until the user leaves
  // this view — otherwise a "missing"/search filter drops the row mid-typing.
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

  const rows = useMemo(() => {
    const visible = new Set(workspace.filteredEntries.map((entry) => entry.id));
    for (const entryId of stickyIds) visible.add(entryId);
    const out: Array<
      { kind: "section"; name: string } | { kind: "entry"; entry: TranslationEntry }
    > = [];
    let pendingSection: string | null = null;
    for (const item of workspace.items) {
      if (item.type === "section") {
        pendingSection = item.name;
      } else if (item.type === "entry" && visible.has(item.id)) {
        if (pendingSection) {
          out.push({ kind: "section", name: pendingSection });
          pendingSection = null;
        }
        out.push({ kind: "entry", entry: item });
      }
    }
    return out;
  }, [workspace.items, workspace.filteredEntries, stickyIds]);

  const terminologyCount = useMemo(
    () =>
      workspace.items.filter(
        (item) => item.type === "entry" && workspace.terminologyIssuesFor(item).length > 0,
      ).length,
    [workspace],
  );

  const { terminologyIssuesFor } = workspace;
  const listApi = useRef<VirtualListApi | null>(null);

  // Card geometry is calibrated against the real DOM once, then every row's
  // height is derived from it — so the virtual list knows the full scroll
  // extent up front instead of discovering it mid-fling.
  const [metrics, setMetrics] = useState<CardMetrics | null>(null);
  const heights = useMemo(() => (metrics ? new CardHeightCache(metrics) : null), [metrics]);

  useEffect(() => {
    const list = listApi.current?.getScrollElement();
    if (!list) return;

    let frame = 0;
    const recalibrate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = calibrateCardMetrics(list);
        if (next) setMetrics(next);
      });
    };

    recalibrate();
    // Wrapping depends on the container width and on the font actually in use.
    const observer = new ResizeObserver(recalibrate);
    observer.observe(list);
    void document.fonts?.ready.then(recalibrate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [workspace.fonts]);

  useEffect(() => {
    const flush = () => {
      const request = takePendingScroll();
      if (!request || !listApi.current) return;
      const index = rows.findIndex((row) =>
        request.type === "section"
          ? row.kind === "section" && row.name === request.name
          : row.kind === "entry" && row.entry.key === request.key,
      );
      if (index < 0) return;
      clearPendingScroll();
      listApi.current.scrollToIndex(index, {
        align: request.type === "section" ? "start" : "center",
      });
    };
    const unsubscribe = subscribeToScrollRequests(flush);
    flush();
    return unsubscribe;
  }, [rows]);

  // Must keep a stable identity: the virtualizer treats a new estimator as a
  // reason to re-measure, which shows up as dropped frames while scrolling.
  const estimateSize = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row || row.kind === "section") return SECTION_HEAD_HEIGHT;
      if (!heights) return FALLBACK_CARD_HEIGHT;
      return heights.heightOf(row.entry, terminologyIssuesFor(row.entry).length);
    },
    [rows, heights, terminologyIssuesFor],
  );

  const emptyKey = workspace.query.trim()
    ? "empty.noMatch"
    : workspace.filter === "missing"
      ? "empty.allDone"
      : workspace.filter === "ws"
        ? "empty.noWs"
        : "empty.generic";

  return (
    <>
      <div className="toolbar">
        <SidebarTrigger title={t("menu.filters")} aria-label={t("menu.filters")} />
        <div className="search">
          <Search className="ic" size={14} aria-hidden="true" />
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("search.ph")}
            value={workspace.query}
            onChange={(event) => workspace.setQuery(event.target.value)}
          />
        </div>
        <BarOptions>
          <button
            type="button"
            className="qbtn"
            title={t("btn.findDblTitle")}
            onClick={() => workspace.setQuery("  ")}
          >
            {t("btn.findDbl")}
          </button>
          <button
            type="button"
            className="qbtn"
            title={t("btn.findTabTitle")}
            onClick={() => workspace.setQuery("\t")}
          >
            {t("btn.findTab")}
          </button>
          {workspace.query.trim() && (
            <span className="qhint">
              {t("query.hint", { q: workspace.query, n: workspace.filteredEntries.length })}
            </span>
          )}
          <button
            type="button"
            className={cn(
              "termpill",
              terminologyCount === 0 && "clean",
              workspace.terminologyFilterActive && "on",
            )}
            title={t("terminology.filterTitle")}
            disabled={terminologyCount === 0}
            onClick={() => workspace.setTerminologyFilterActive(!workspace.terminologyFilterActive)}
          >
            {terminologyCount === 0 ? (
              <CircleCheck size={13} aria-hidden="true" />
            ) : (
              <TriangleAlert size={13} aria-hidden="true" />
            )}
            <span>
              {t(terminologyCount === 1 ? "terminology.count.one" : "terminology.count.other", {
                n: terminologyCount,
              })}
            </span>
          </button>
        </BarOptions>
        <span className="sp" />
        <span className="hint">
          <kbd>Ctrl</kbd>+<kbd>↵</kbd> {t("hint.ctrlEnter")}
        </span>
      </div>

      <VirtualList
        className="list"
        apiRef={listApi}
        items={rows}
        overscan={18}
        estimateSize={estimateSize}
        getKey={(row) => (row.kind === "section" ? `s-${row.name}` : row.entry.id)}
        empty={
          <div className="empty-state">
            {emptyKey === "empty.allDone" && (
              <CircleCheck className="empty-icon" size={18} aria-hidden="true" />
            )}
            {t(emptyKey)}
          </div>
        }
        renderItem={(row) =>
          row.kind === "section" ? (
            <div className="sec-head" data-section={row.name}>
              {sectionLabel(row.name)}
            </div>
          ) : (
            <EntryCard entry={row.entry} onPin={pinEntry} />
          )
        }
      />
    </>
  );
}
