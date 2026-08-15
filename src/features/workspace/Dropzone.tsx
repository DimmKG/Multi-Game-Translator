// SPDX-License-Identifier: AGPL-3.0-or-later
import { FileType2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useI18n } from "@/features/i18n/I18nProvider";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

const LEGEND_ITEMS = [
  { id: "var", color: "var(--tok-var)", labelKey: "legend.var", html: true },
  { id: "ref", color: "var(--tok-ref)", literal: "[item/input=…]" },
  { id: "fmt", color: "var(--tok-fmt)", labelKey: "legend.fmt", html: false },
  { id: "nl", color: "var(--tok-nl)", literal: "\\n" },
] as const;

function FileDropBox({
  testId,
  inputId,
  label,
  hint,
  file,
  disabled,
  pickLabel,
  onFile,
}: {
  testId: string;
  inputId: string;
  label: string;
  hint: string;
  file: File | null;
  disabled: boolean;
  pickLabel: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      data-testid={testId}
      className={cn(
        "grid gap-1.5 rounded-lg border-2 border-dashed p-3.5 text-start transition",
        !disabled && "cursor-pointer",
        disabled && "border-border opacity-50",
        !disabled && !file && "border-warn bg-warn-soft",
        !disabled && file && "border-success bg-success-soft",
        dragging && !disabled && "border-primary bg-primary-soft",
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) onFile(dropped);
      }}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="ltr-isolate text-muted-foreground truncate text-xs">
        {file ? file.name : hint}
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".lang,.txt"
        hidden
        disabled={disabled}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) onFile(picked);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        className="mt-1 justify-self-start"
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
      >
        {pickLabel}
      </Button>
    </div>
  );
}

export function Dropzone() {
  const { t } = useI18n();
  const { openWorkspaceWithReference, createFromReferenceFile, isImportingFile } = useWorkspace();
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [translationFile, setTranslationFile] = useState<File | null>(null);

  const canOpen = originalFile != null && translationFile != null && !isImportingFile;
  const canCreateNew = originalFile != null && translationFile == null && !isImportingFile;

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <Empty
        id="drop"
        data-testid="dropzone"
        aria-busy={isImportingFile}
        className="bg-card w-[min(560px,90%)] border-[1.5px] border-dashed px-[34px] py-11 transition"
      >
        <EmptyHeader className="max-w-none">
          <EmptyMedia
            variant="icon"
            className="bg-primary-soft text-primary mb-[18px] size-14 rounded-xl [&_svg:not([class*='size-'])]:size-[26px]"
            aria-hidden="true"
            data-testid="dropzone-icon"
          >
            {isImportingFile ? <Loader2 className="animate-spin" /> : <FileType2 />}
          </EmptyMedia>

          <EmptyTitle
            data-testid="dropzone-title"
            className="text-primary mb-1.5 font-mono text-xl font-bold tracking-[0.5px]"
          >
            *.lang
          </EmptyTitle>

          <EmptyDescription
            className="mb-5 text-[13.5px]"
            dangerouslySetInnerHTML={{
              __html: isImportingFile ? t("drop.loading") : t("drop.text"),
            }}
          />
        </EmptyHeader>

        <EmptyContent className="max-w-none gap-0">
          <div className="mb-4 grid w-full gap-3 sm:grid-cols-2">
            <FileDropBox
              testId="dropzone-original"
              inputId="originalFileInput"
              label={t("drop.originalLabel")}
              hint={t("drop.originalHint")}
              pickLabel={t("drop.pick")}
              file={originalFile}
              disabled={isImportingFile}
              onFile={setOriginalFile}
            />
            <FileDropBox
              testId="dropzone-translation"
              inputId="translationFileInput"
              label={t("drop.translationLabel")}
              hint={originalFile ? t("drop.pick") : t("drop.translationRequiresOriginalHint")}
              pickLabel={t("drop.pick")}
              file={translationFile}
              disabled={isImportingFile || !originalFile}
              onFile={setTranslationFile}
            />
          </div>

          <div className="mb-[22px] flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              id="btnOpenTranslation"
              disabled={!canOpen}
              onClick={() => {
                if (originalFile && translationFile) {
                  void openWorkspaceWithReference(translationFile, originalFile);
                }
              }}
            >
              {t("drop.open")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              data-new-translation-button=""
              title={t("btn.newTranslationTitle")}
              disabled={!canCreateNew}
              onClick={() => {
                if (originalFile) void createFromReferenceFile(originalFile);
              }}
            >
              {t("btn.newTranslation")}
            </Button>
          </div>

          <div
            className="text-foreground-faint flex flex-wrap justify-center gap-4 text-[11.5px]"
            data-testid="dropzone-legend"
          >
            {LEGEND_ITEMS.map((item) => (
              <span key={item.id} className="flex items-center gap-1.5">
                <i
                  className="inline-block size-[9px] shrink-0 rounded-sm"
                  style={{ background: item.color }}
                />
                {"literal" in item ? (
                  <span className="ltr-isolate">{item.literal}</span>
                ) : item.html ? (
                  <span
                    className="ltr-isolate"
                    dangerouslySetInnerHTML={{ __html: t(item.labelKey) }}
                  />
                ) : (
                  <span className="ltr-isolate">{t(item.labelKey)}</span>
                )}
              </span>
            ))}
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
