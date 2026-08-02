import { FileType2 } from "lucide-react";
import { useRef, useState } from "react";

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
    <div className="empty">
      <div
        id="drop"
        data-testid="dropzone"
        className={cn("drop", dragging && "over")}
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
        <div className="lg" aria-hidden="true" data-testid="dropzone-icon">
          <FileType2 size={26} />
        </div>

        <h1 data-testid="dropzone-title">*.lang</h1>

        <p dangerouslySetInnerHTML={{ __html: t("drop.text") }} />

        <div className="actions">
          <button
            type="button"
            id="btnPick"
            className="btn primary"
            onClick={() => inputRef.current?.click()}
          >
            {t("drop.pick")}
          </button>
          <button
            type="button"
            className="btn ghost"
            data-new-translation-button=""
            title={t("btn.newTranslationTitle")}
            onClick={() => newRef.current?.click()}
          >
            {t("btn.newTranslation")}
          </button>
        </div>

        <div className="legend" data-testid="dropzone-legend">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.id}>
              <i style={{ background: item.color }} />
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
      </div>
    </div>
  );
}
