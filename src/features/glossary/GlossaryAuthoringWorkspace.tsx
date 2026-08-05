// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";

import { VirtualList } from "@/components/layout/VirtualList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GLOSSARY_ENTRY_STATUSES } from "@/core/glossary/contract";
import {
  glossaryDraftEntrySearchText,
  glossaryValuesFromMultiline,
} from "@/core/glossary/authoring-editor";
import { createGlossaryDraftEntry, type GlossaryDraftEntry } from "@/core/glossary/draft";
import {
  isGlossaryAuthoringSessionDirty,
  validateGlossaryAuthoringSession,
} from "@/core/glossary/authoring-session";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

import { GlossaryDialog } from "./GlossaryDialog";

type ValidationFilter = "all" | "errors" | "warnings";

export function GlossaryAuthoringWorkspace() {
  const { t } = useI18n();
  const workspace = useWorkspace();
  const session = workspace.glossaryAuthoringSession;
  const [managerOpen, setManagerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>("all");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const validation = useMemo(
    () => (session ? validateGlossaryAuthoringSession(session) : null),
    [session],
  );

  const problemsByEntry = useMemo(() => {
    const result = new Map<number, { errors: number; warnings: number }>();
    for (const problem of validation?.problems ?? []) {
      if (problem.entryIndex === undefined) continue;
      const current = result.get(problem.entryIndex) ?? { errors: 0, warnings: 0 };
      current[problem.severity === "error" ? "errors" : "warnings"] += 1;
      result.set(problem.entryIndex, current);
    }
    return result;
  }, [validation]);

  const categories = useMemo(
    () =>
      session
        ? [...new Set(session.draft.entries.map((entry) => entry.category).filter(Boolean))].sort()
        : [],
    [session],
  );

  const filteredEntries = useMemo(() => {
    if (!session) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return session.draft.entries.flatMap((entry, index) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) return [];
      if (categoryFilter !== "all" && entry.category !== categoryFilter) return [];
      const problems = problemsByEntry.get(index) ?? { errors: 0, warnings: 0 };
      if (validationFilter === "errors" && problems.errors === 0) return [];
      if (validationFilter === "warnings" && problems.warnings === 0) return [];
      if (normalizedQuery && !glossaryDraftEntrySearchText(entry).includes(normalizedQuery)) {
        return [];
      }
      return [{ entry, index, problems }];
    });
  }, [categoryFilter, problemsByEntry, query, session, statusFilter, validationFilter]);

  const selected =
    filteredEntries.find((item) => item.index === selectedIndex) ?? filteredEntries[0] ?? null;

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        if (workspace.importGlossaryAuthoring(text, file.name)) setSelectedIndex(null);
      });
    };
    input.click();
  };

  const newGlossary = () => {
    if (workspace.createGlossaryAuthoring()) setSelectedIndex(null);
  };

  const updateEntry = (index: number, update: (entry: GlossaryDraftEntry) => void) => {
    workspace.updateGlossaryAuthoring((draft) => {
      const entry = draft.entries[index];
      if (entry) update(entry);
    });
  };

  const addEntry = () => {
    if (!session) return;
    const index = session.draft.entries.length;
    workspace.updateGlossaryAuthoring((draft) => {
      draft.entries.push(createGlossaryDraftEntry());
    });
    setSelectedIndex(index);
  };

  const duplicateEntry = () => {
    if (!session || !selected) return;
    const index = session.draft.entries.length;
    workspace.updateGlossaryAuthoring((draft) => {
      draft.entries.push(createGlossaryDraftEntry(draft.entries[selected.index]));
    });
    setSelectedIndex(index);
  };

  const deleteEntry = () => {
    if (!selected || !window.confirm(t("glossary.authoringDeleteEntryConfirm"))) return;
    workspace.updateGlossaryAuthoring((draft) => {
      draft.entries.splice(selected.index, 1);
    });
    setSelectedIndex(null);
  };

  const exportJson = () => {
    if (!validation || validation.errors.length > 0) return;
    if (
      validation.warnings.length > 0 &&
      !window.confirm(
        t("glossary.authoringExportWarningsConfirm", { n: validation.warnings.length }),
      )
    ) {
      return;
    }
    workspace.exportGlossaryAuthoring();
  };

  if (!session) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <section className="border-border grid max-w-xl gap-4 rounded-xl border p-6 text-center">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold">{t("glossary.authoringEmptyTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("glossary.authoringEmptyHint")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={newGlossary}>{t("glossary.authoringNew")}</Button>
            <Button variant="outline" onClick={importJson}>
              {t("glossary.import")}
            </Button>
            <Button variant="outline" onClick={() => setManagerOpen(true)}>
              {t("glossary.authoringOpenManager")}
            </Button>
          </div>
          <GlossaryDialog open={managerOpen} onOpenChange={setManagerOpen} />
        </section>
      </div>
    );
  }

  const dirty = isGlossaryAuthoringSessionDirty(session);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <div className="me-auto min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="truncate">
              {session.draft.name || t("glossary.authoringUntitled")}
            </strong>
            <Badge variant={dirty ? "destructive" : "secondary"}>
              {dirty ? t("glossary.authoringUnsaved") : t("glossary.authoringSavedState")}
            </Badge>
          </div>
          <p className="ltr-isolate text-muted-foreground truncate text-xs">
            {session.draft.id || "—"} · {session.draft.sourceLanguage || "—"} →{" "}
            {session.draft.targetLanguage || "—"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={newGlossary}>
          {t("glossary.authoringNew")}
        </Button>
        <Button size="sm" variant="outline" onClick={importJson}>
          {t("glossary.import")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setManagerOpen(true)}>
          {t("glossary.authoringOpenManager")}
        </Button>
        <Button
          size="sm"
          disabled={!validation?.valid}
          onClick={() => workspace.saveGlossaryAuthoring()}
        >
          {t("glossary.authoringSave")}
        </Button>
        <Button size="sm" variant="outline" disabled={!validation?.valid} onClick={exportJson}>
          {t("glossary.authoringExport")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowValidation((value) => !value)}>
          {t("glossary.authoringValidate")}
          <Badge variant={validation?.errors.length ? "destructive" : "outline"}>
            {validation?.errors.length ?? 0} / {validation?.warnings.length ?? 0}
          </Badge>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => workspace.closeGlossaryAuthoring()}>
          {t("glossary.authoringClose")}
        </Button>
      </div>

      {showValidation && validation && (
        <section className="border-border max-h-40 overflow-auto rounded-lg border p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant={validation.errors.length ? "destructive" : "outline"}>
              {t("glossary.authoringErrors", { n: validation.errors.length })}
            </Badge>
            <Badge variant="outline">
              {t("glossary.authoringWarnings", { n: validation.warnings.length })}
            </Badge>
          </div>
          {validation.problems.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("glossary.authoringValid")}</p>
          ) : (
            <ul className="grid gap-1 text-xs">
              {validation.problems.map((problem, index) => (
                <li key={`${problem.code}:${problem.path}:${index}`}>
                  <Badge variant={problem.severity === "error" ? "destructive" : "outline"}>
                    {problem.severity === "error"
                      ? t("glossary.authoringError")
                      : t("glossary.authoringWarning")}
                  </Badge>{" "}
                  <code>{problem.path}</code> · <code>{problem.code}</code>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <details className="border-border rounded-lg border" open>
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          {t("glossary.authoringDetails")}
        </summary>
        <div className="border-border grid gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["id", "glossary.authoringId"],
            ["name", "glossary.authoringName"],
            ["sourceLanguage", "glossary.authoringSourceLanguage"],
            ["targetLanguage", "glossary.authoringTargetLanguage"],
            ["game", "glossary.authoringGame"],
          ].map(([field, label]) => (
            <label key={field} className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t(label)}</span>
              <input
                className="border-input bg-background h-9 rounded-md border px-3"
                value={String(session.draft[field as keyof typeof session.draft] ?? "")}
                onChange={(event) =>
                  workspace.updateGlossaryAuthoring((draft) => {
                    (draft as unknown as Record<string, string>)[field] = event.target.value;
                  })
                }
              />
            </label>
          ))}
          <label className="grid gap-1 text-sm lg:col-span-2">
            <span className="text-muted-foreground">{t("glossary.authoringAuthors")}</span>
            <textarea
              className="border-input bg-background min-h-20 rounded-md border px-3 py-2"
              value={session.draft.authors.join("\n")}
              onChange={(event) =>
                workspace.updateGlossaryAuthoring((draft) => {
                  draft.authors = glossaryValuesFromMultiline(event.target.value);
                })
              }
            />
          </label>
          <div className="grid content-start gap-1 text-sm">
            <span className="text-muted-foreground">{t("glossary.authoringUpdatedAt")}</span>
            <span className="ltr-isolate border-input bg-muted h-9 rounded-md border px-3 py-2">
              {session.draft.updatedAt || "—"}
            </span>
          </div>
        </div>
      </details>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(26rem,1.2fr)]">
        <section className="border-border flex min-h-0 flex-col overflow-hidden rounded-lg border">
          <div className="border-border grid gap-2 border-b p-3">
            <input
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              placeholder={t("glossary.authoringSearch")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">{t("glossary.authoringAllStatuses")}</option>
                {GLOSSARY_ENTRY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">{t("glossary.authoringAllCategories")}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                value={validationFilter}
                onChange={(event) => setValidationFilter(event.target.value as ValidationFilter)}
              >
                <option value="all">{t("glossary.authoringAllValidation")}</option>
                <option value="errors">{t("glossary.authoringOnlyErrors")}</option>
                <option value="warnings">{t("glossary.authoringOnlyWarnings")}</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                {filteredEntries.length} / {session.draft.entries.length}
              </span>
              <Button size="sm" onClick={addEntry}>
                {t("glossary.authoringAddEntry")}
              </Button>
            </div>
          </div>
          <VirtualList
            items={filteredEntries}
            className="min-h-0 flex-1 overflow-auto p-2"
            estimateSize={() => 84}
            overscan={10}
            getKey={(item) => `${item.index}:${item.entry.source}`}
            empty={<p className="text-muted-foreground p-3 text-sm">{t("empty.noMatch")}</p>}
            renderItem={(item) => (
              <button
                type="button"
                className={cn(
                  "border-border mb-2 grid w-full gap-1 rounded-md border p-3 text-start",
                  "hover:bg-muted/60 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  item.index === selected?.index && "bg-muted",
                )}
                onClick={() => setSelectedIndex(item.index)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <strong className="truncate">{item.entry.source || t("badge.missing")}</strong>
                  {item.problems.errors > 0 && (
                    <Badge variant="destructive">{item.problems.errors}</Badge>
                  )}
                  {item.problems.warnings > 0 && (
                    <Badge variant="outline">{item.problems.warnings}</Badge>
                  )}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {item.entry.target || t("badge.missing")} · {item.entry.status}
                  {item.entry.category ? ` · ${item.entry.category}` : ""}
                </span>
              </button>
            )}
          />
        </section>

        <section className="border-border min-h-0 overflow-auto rounded-lg border p-4">
          {!selected ? (
            <p className="text-muted-foreground text-sm">{t("glossary.authoringSelectEntry")}</p>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{selected.entry.source || t("glossary.authoringUntitledEntry")}</strong>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={duplicateEntry}>
                    {t("glossary.authoringDuplicateEntry")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={deleteEntry}>
                    {t("glossary.authoringDeleteEntry")}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span>{t("glossary.authoringEntrySource")}</span>
                  <input
                    className="border-input bg-background h-9 rounded-md border px-3"
                    value={selected.entry.source}
                    onChange={(event) =>
                      updateEntry(selected.index, (entry) => {
                        entry.source = event.target.value;
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t("glossary.authoringPreferredTarget")}</span>
                  <input
                    className="border-input bg-background h-9 rounded-md border px-3"
                    value={selected.entry.target}
                    onChange={(event) =>
                      updateEntry(selected.index, (entry) => {
                        entry.target = event.target.value;
                      })
                    }
                  />
                </label>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {(["forms", "alternatives", "forbidden"] as const).map((field) => (
                  <label key={field} className="grid gap-1 text-sm">
                    <span>{t(`glossary.authoring.${field}`)}</span>
                    <textarea
                      className="border-input bg-background min-h-28 rounded-md border px-3 py-2"
                      value={selected.entry[field].join("\n")}
                      onChange={(event) =>
                        updateEntry(selected.index, (entry) => {
                          entry[field] = glossaryValuesFromMultiline(event.target.value);
                        })
                      }
                    />
                    <span className="text-muted-foreground text-xs">
                      {t("glossary.authoringOnePerLine")}
                    </span>
                  </label>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span>{t("glossary.authoringStatus")}</span>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3"
                    value={selected.entry.status}
                    onChange={(event) =>
                      updateEntry(selected.index, (entry) => {
                        entry.status = event.target.value;
                      })
                    }
                  >
                    {GLOSSARY_ENTRY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t("glossary.authoringCategory")}</span>
                  <input
                    className="border-input bg-background h-9 rounded-md border px-3"
                    value={selected.entry.category}
                    onChange={(event) =>
                      updateEntry(selected.index, (entry) => {
                        entry.category = event.target.value;
                      })
                    }
                  />
                </label>
                <div className="flex flex-wrap items-end gap-4 pb-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.entry.caseSensitive}
                      onChange={(event) =>
                        updateEntry(selected.index, (entry) => {
                          entry.caseSensitive = event.target.checked;
                        })
                      }
                    />
                    {t("glossary.authoringCaseSensitive")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.entry.wholeWord}
                      onChange={(event) =>
                        updateEntry(selected.index, (entry) => {
                          entry.wholeWord = event.target.checked;
                        })
                      }
                    />
                    {t("glossary.authoringWholeWord")}
                  </label>
                </div>
              </div>

              <label className="grid gap-1 text-sm">
                <span>{t("glossary.authoringContext")}</span>
                <textarea
                  className="border-input bg-background min-h-20 rounded-md border px-3 py-2"
                  value={selected.entry.context}
                  onChange={(event) =>
                    updateEntry(selected.index, (entry) => {
                      entry.context = event.target.value;
                    })
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t("glossary.authoringNote")}</span>
                <textarea
                  className="border-input bg-background min-h-20 rounded-md border px-3 py-2"
                  value={selected.entry.note}
                  onChange={(event) =>
                    updateEntry(selected.index, (entry) => {
                      entry.note = event.target.value;
                    })
                  }
                />
              </label>
            </div>
          )}
        </section>
      </div>

      <GlossaryDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </div>
  );
}
