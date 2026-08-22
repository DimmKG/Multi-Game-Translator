// SPDX-License-Identifier: AGPL-3.0-or-later
import { FileType2, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  defaultLoaderConfig,
  resolveLoaderConfigSchema,
  type LoaderConfigField,
  type LoaderConfigValues,
} from "@mgt/sdk";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/features/i18n/I18nProvider";
import { auxRoleOf, resolveGameLoader } from "@/state/loaders";
import { useWorkspace } from "@/state/workspace-store";
import { cn } from "@/lib/utils";

/**
 * One field from a loader's configSchema, rendered generically — the host
 * never knows what any given field means, only its fixed type (see
 * LoaderConfigField in the SDK). Resolved against `{ files: [] }`: every
 * loader today either has no configSchema or a static one; a future
 * file-dependent schema (e.g. a CSV loader offering its own column names)
 * needs Dropzone to eagerly read dropped files' text first — not done here,
 * deliberately, since nothing needs it yet.
 */
function LoaderConfigFormField({
  field,
  value,
  onChange,
}: {
  field: LoaderConfigField;
  value: LoaderConfigValues[string];
  onChange: (value: LoaderConfigValues[string]) => void;
}) {
  const { t } = useI18n();
  if (field.type === "boolean") {
    return (
      <label className="flex items-start gap-2.5">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span className="grid gap-0.5">
          <span className="text-sm">{t(field.labelKey)}</span>
          {field.hintKey && (
            <span className="text-muted-foreground text-xs">{t(field.hintKey)}</span>
          )}
        </span>
      </label>
    );
  }
  if (field.type === "enum") {
    return (
      <div className="grid gap-1">
        <Label>{t(field.labelKey)}</Label>
        <Select value={String(value)} onValueChange={(next) => onChange(next)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.hintKey && <p className="text-muted-foreground text-xs">{t(field.hintKey)}</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-1">
      <Label>{t(field.labelKey)}</Label>
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={String(value)}
        onChange={(event) =>
          onChange(field.type === "number" ? Number(event.target.value) : event.target.value)
        }
      />
      {field.hintKey && <p className="text-muted-foreground text-xs">{t(field.hintKey)}</p>}
    </div>
  );
}

function FileDropBox({
  testId,
  inputId,
  label,
  hint,
  file,
  disabled,
  pickLabel,
  accept,
  onFile,
}: {
  testId: string;
  inputId: string;
  label: string;
  hint: string;
  file: File | null;
  disabled: boolean;
  pickLabel: string;
  accept: string[];
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
        accept={accept.join(",")}
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
  const { selectedGameLoaderId, openWorkspaceFiles, createFromReferenceFile, isImportingFile } =
    useWorkspace();
  // App.tsx only renders Dropzone once flowStage === "dropzone", i.e. a game is already
  // selected — NOT `activeLoader` here, that reflects the currently *open document's*
  // loader (stays a meaningless placeholder until a document actually exists).
  const selectedLoader = resolveGameLoader(selectedGameLoaderId!);
  const auxRole = auxRoleOf(selectedLoader);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const configSchema = useMemo(
    () => resolveLoaderConfigSchema(selectedLoader.configSchema, { files: [] }),
    [selectedLoader],
  );
  const [config, setConfig] = useState<LoaderConfigValues>(() => defaultLoaderConfig(configSchema));

  const canOpen =
    selectedLoader.requiredFiles.every((rf) => !rf.required || files[rf.role] != null) &&
    !isImportingFile;
  const canCreateNew =
    selectedLoader.createFromReference != null &&
    (auxRole ? files[auxRole] != null : false) &&
    selectedLoader.requiredFiles.every((rf) => rf.role === auxRole || files[rf.role] == null) &&
    !isImportingFile;

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
            {selectedLoader.displayName}
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
            {selectedLoader.requiredFiles.map((rf) => (
              <FileDropBox
                key={rf.role}
                testId={`dropzone-${rf.role}`}
                inputId={`${rf.role}FileInput`}
                label={t(rf.labelKey)}
                hint={t(`${rf.labelKey}Hint`)}
                pickLabel={t("drop.pick")}
                file={files[rf.role] ?? null}
                disabled={isImportingFile}
                accept={rf.accept}
                onFile={(file) => setFiles((prev) => ({ ...prev, [rf.role]: file }))}
              />
            ))}
          </div>

          {configSchema.length > 0 && (
            <div className="border-border-soft bg-secondary/40 mb-4 w-full rounded-lg border p-3 text-start">
              <p className="text-foreground-faint mb-2.5 text-[11px] tracking-[0.1em] uppercase">
                {t("drop.settingsTitle")}
              </p>
              <div className="grid gap-3">
                {configSchema.map((field) => (
                  <LoaderConfigFormField
                    key={field.key}
                    field={field}
                    value={config[field.key]}
                    onChange={(value) => setConfig((prev) => ({ ...prev, [field.key]: value }))}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-[22px] flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              id="btnOpenTranslation"
              disabled={!canOpen}
              onClick={() => {
                const picked: Record<string, File> = {};
                for (const rf of selectedLoader.requiredFiles) {
                  const file = files[rf.role];
                  if (file) picked[rf.role] = file;
                }
                void openWorkspaceFiles(picked, config);
              }}
            >
              {t("drop.open")}
            </Button>
            {selectedLoader.createFromReference != null && (
              <Button
                type="button"
                variant="ghost"
                data-new-translation-button=""
                title={t("btn.newTranslationTitle")}
                disabled={!canCreateNew}
                onClick={() => {
                  const referenceFile = auxRole ? files[auxRole] : undefined;
                  if (referenceFile) void createFromReferenceFile(referenceFile, config);
                }}
              >
                {t("btn.newTranslation")}
              </Button>
            )}
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
