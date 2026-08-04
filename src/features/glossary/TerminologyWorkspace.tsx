// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildTerminologyCandidateExport,
  extractTerminologyCandidates,
  type TerminologyCandidate,
  type TerminologyCorpusFile,
} from "@/core/terminology/extract-candidates";
import { suggestLanguageCodeFromFilename } from "@/core/terminology/language-code";
import { buildTerminologyReviewExport } from "@/core/terminology/review-export";
import {
  buildTerminologyReviewSessionId,
  loadTerminologyReviewState,
} from "@/core/terminology/review-persistence";
import { useI18n } from "@/features/i18n/I18nProvider";
import { cn } from "@/lib/utils";

import { TerminologyGlossaryMergeWorkspace } from "./TerminologyGlossaryMergeWorkspace";
import { TerminologyReviewWorkspace } from "./TerminologyReviewWorkspace";

interface LoadedCorpusFile extends TerminologyCorpusFile {
  id: string;
}

type TerminologySection = "sources" | "review" | "merge";

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readCorpusFile(file: File, languageCode = ""): Promise<LoadedCorpusFile> {
  return {
    id: crypto.randomUUID(),
    languageCode: languageCode.trim() || suggestLanguageCodeFromFilename(file.name),
    filename: file.name,
    text: await file.text(),
  };
}

export function TerminologyWorkspace() {
  const { t } = useI18n();
  const [section, setSection] = useState<TerminologySection>("sources");
  const [sourceLanguageCode, setSourceLanguageCode] = useState("en");
  const [sourceFile, setSourceFile] = useState<LoadedCorpusFile | null>(null);
  const [translatedFiles, setTranslatedFiles] = useState<LoadedCorpusFile[]>([]);
  const [minimumFrequency, setMinimumFrequency] = useState(2);
  const [candidates, setCandidates] = useState<TerminologyCandidate[]>([]);

  const conflictCount = useMemo(
    () =>
      candidates.reduce(
        (total, candidate) =>
          total + candidate.languages.filter((language) => language.hasConflict).length,
        0,
      ),
    [candidates],
  );

  const reviewSessionId = useMemo(() => {
    if (!sourceFile) return "empty";
    return buildTerminologyReviewSessionId(
      { ...sourceFile, languageCode: sourceLanguageCode.trim() },
      translatedFiles.map((file) => ({
        ...file,
        languageCode: file.languageCode.trim(),
      })),
      minimumFrequency,
    );
  }, [minimumFrequency, sourceFile, sourceLanguageCode, translatedFiles]);

  const reviewExport =
    sourceFile && candidates.length > 0
      ? buildTerminologyReviewExport(
          { ...sourceFile, languageCode: sourceLanguageCode.trim() },
          candidates,
          loadTerminologyReviewState(
            reviewSessionId,
            new Set(candidates.map((candidate) => candidate.source)),
          ),
        )
      : null;

  const pickSource = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lang,text/plain";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const suggested = suggestLanguageCodeFromFilename(file.name);
      void readCorpusFile(file, suggested || sourceLanguageCode)
        .then((loaded) => {
          setSourceFile(loaded);
          if (suggested) setSourceLanguageCode(suggested);
          setCandidates([]);
          setSection("sources");
        })
        .catch((error: Error) => toast.error(t("err.readFile", { msg: error.message })));
    };
    input.click();
  };

  const pickTranslations = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lang,text/plain";
    input.multiple = true;
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      void Promise.all(files.map((file) => readCorpusFile(file)))
        .then((loaded) => {
          setTranslatedFiles((current) => [...current, ...loaded]);
          setCandidates([]);
          setSection("sources");
        })
        .catch((error: Error) => toast.error(t("err.readFile", { msg: error.message })));
    };
    input.click();
  };

  const canExtract =
    sourceFile != null &&
    sourceLanguageCode.trim() !== "" &&
    translatedFiles.length > 0 &&
    translatedFiles.every((file) => file.languageCode.trim() !== "");

  const generateCandidates = () => {
    if (!sourceFile) return;
    const next = extractTerminologyCandidates(
      { ...sourceFile, languageCode: sourceLanguageCode.trim() },
      translatedFiles.map((file) => ({
        ...file,
        languageCode: file.languageCode.trim(),
      })),
      {
        minimumSourceFrequency: minimumFrequency,
        includeSingleOccurrences: minimumFrequency === 1,
      },
    );
    setCandidates(next);
    setSection("review");
  };

  const exportCandidateJson = () => {
    if (!sourceFile) return;
    const exported = buildTerminologyCandidateExport(
      { ...sourceFile, languageCode: sourceLanguageCode.trim() },
      candidates,
    );
    downloadJson("necesse-terminology-candidates.json", exported);
  };

  const exportReviewJson = () => {
    if (!reviewExport) return;
    downloadJson("necesse-terminology-review.json", reviewExport);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("terminology.title")}</h2>
        {candidates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{candidates.length}</Badge>
            <Badge variant={conflictCount > 0 ? "destructive" : "secondary"}>{conflictCount}</Badge>
          </div>
        )}
      </header>

      <div className="border-border flex flex-none gap-1 border-b">
        <button
          type="button"
          className={cn(
            "border-primary px-3 py-2 text-sm font-medium",
            section === "sources"
              ? "text-foreground border-b-2"
              : "text-muted-foreground border-b-2 border-transparent",
          )}
          onClick={() => setSection("sources")}
        >
          {t("terminology.title")}
        </button>
        <button
          type="button"
          className={cn(
            "border-primary px-3 py-2 text-sm font-medium",
            section === "review"
              ? "text-foreground border-b-2"
              : "text-muted-foreground border-b-2 border-transparent",
          )}
          onClick={() => setSection("review")}
        >
          {t("tab.review")}
        </button>
        <button
          type="button"
          className={cn(
            "border-primary px-3 py-2 text-sm font-medium",
            section === "merge"
              ? "text-foreground border-b-2"
              : "text-muted-foreground border-b-2 border-transparent",
          )}
          onClick={() => setSection("merge")}
        >
          {t("glossary.button")}
        </button>
      </div>

      {section === "sources" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid gap-4 pb-4">
            <div className="grid gap-4 md:grid-cols-2">
              <section className="border-border grid gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong>{t("btn.enRef")}</strong>
                  <Button size="sm" variant="outline" onClick={pickSource}>
                    {t("drop.pick")}
                  </Button>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">{t("mt.langLabel")}</span>
                  <input
                    className="border-input bg-background h-9 rounded-md border px-3"
                    value={sourceLanguageCode}
                    onChange={(event) => {
                      setSourceLanguageCode(event.target.value);
                      setSourceFile((current) =>
                        current ? { ...current, languageCode: event.target.value } : current,
                      );
                    }}
                  />
                </label>
                <p className="ltr-isolate text-muted-foreground truncate text-sm">
                  {sourceFile?.filename ?? t("reference.notLoaded")}
                </p>
              </section>

              <section className="border-border grid gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong>{t("review.trLabel")}</strong>
                  <Button size="sm" variant="outline" onClick={pickTranslations}>
                    {t("drop.pick")} · +
                  </Button>
                </div>
                <div className="grid gap-2">
                  {translatedFiles.length === 0 && (
                    <p className="text-muted-foreground text-sm">{t("empty.generic")}</p>
                  )}
                  {translatedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="grid grid-cols-[6rem_1fr_auto] items-center gap-2"
                    >
                      <label className="grid min-w-0 gap-1">
                        <span className="text-muted-foreground text-xs">{t("mt.langLabel")}</span>
                        <input
                          aria-label={`${t("mt.langLabel")}: ${file.filename}`}
                          className="border-input bg-background h-8 min-w-0 rounded-md border px-2 text-sm"
                          placeholder="bg"
                          value={file.languageCode}
                          onChange={(event) => {
                            setTranslatedFiles((current) =>
                              current.map((item) =>
                                item.id === file.id
                                  ? { ...item, languageCode: event.target.value }
                                  : item,
                              ),
                            );
                            setCandidates([]);
                          }}
                        />
                      </label>
                      <span className="ltr-isolate truncate text-sm" title={file.filename}>
                        {file.filename}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTranslatedFiles((current) =>
                            current.filter((item) => item.id !== file.id),
                          );
                          setCandidates([]);
                        }}
                      >
                        {t("glossary.remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">{t("terminology.filter")}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="border-input bg-background h-9 w-28 rounded-md border px-3"
                  value={minimumFrequency}
                  onChange={(event) =>
                    setMinimumFrequency(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </label>
              <Button disabled={!canExtract} onClick={generateCandidates}>
                {t("terminology.title")}
              </Button>
              <Button
                variant="outline"
                disabled={!sourceFile || candidates.length === 0}
                onClick={exportCandidateJson}
              >
                {t("btn.export")}
              </Button>
              <Button
                variant="outline"
                disabled={!reviewExport}
                onClick={exportReviewJson}
              >
                {t("tab.review")} · {t("btn.export")}
              </Button>
            </div>
          </div>
        </div>
      ) : section === "review" ? (
        <TerminologyReviewWorkspace
          key={reviewSessionId}
          candidates={candidates}
          sessionId={reviewSessionId}
        />
      ) : (
        <TerminologyGlossaryMergeWorkspace review={reviewExport} />
      )}
    </section>
  );
}
