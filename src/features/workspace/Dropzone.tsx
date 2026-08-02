import { FileType2 } from "lucide-react";
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

export function Dropzone() {
  const { t } = useI18n();
  const { openLangFile, createFromReferenceFile } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <Empty
        id="drop"
        data-testid="dropzone"
        className={cn(
          "bg-card w-[min(560px,90%)] border-[1.5px] border-dashed px-[34px] py-11 transition",
          dragging && "border-primary bg-secondary",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void openLangFile(file);
        }}
      >
        <EmptyHeader className="max-w-none">
          <EmptyMedia
            variant="icon"
            className="bg-primary-soft text-primary mb-[18px] size-14 rounded-xl [&_svg:not([class*='size-'])]:size-[26px]"
            aria-hidden="true"
            data-testid="dropzone-icon"
          >
            <FileType2 />
          </EmptyMedia>

          <EmptyTitle
            data-testid="dropzone-title"
            className="text-primary mb-1.5 font-mono text-xl font-bold tracking-[0.5px]"
          >
            *.lang
          </EmptyTitle>

          <EmptyDescription
            className="mb-5 text-[13.5px]"
            dangerouslySetInnerHTML={{ __html: t("drop.text") }}
          />
        </EmptyHeader>

        <EmptyContent className="max-w-none gap-0">
          <div className="mb-[22px] flex flex-wrap items-center justify-center gap-2">
            <Button type="button" id="btnPick" onClick={() => inputRef.current?.click()}>
              {t("drop.pick")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              data-new-translation-button=""
              title={t("btn.newTranslationTitle")}
              onClick={() => newRef.current?.click()}
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

        <input
          ref={inputRef}
          id="fileInput"
          type="file"
          accept=".lang,.txt"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openLangFile(file);
            event.target.value = "";
          }}
        />
        <input
          ref={newRef}
          id="newTranslationInput"
          type="file"
          accept=".lang,.txt"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void createFromReferenceFile(file);
            event.target.value = "";
          }}
        />
      </Empty>
    </div>
  );
}
