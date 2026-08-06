// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { buildLangFile } from "@/core/lang/export";
import type {
  DiffMode,
  FilterMode,
  LangLine,
  ReviewFilter,
  WorkspaceView,
} from "@/core/lang/markers";
import {
  applyReferenceMap,
  cleanLangFilename,
  createTranslationFromReference,
  parseLangFile,
  parseReferenceLang,
} from "@/core/lang/parse";
import { hasUsableReference, type TranslationEntry } from "@/core/lang/status";
import {
  deserializeProgress,
  serializeProgress,
  type WorkspaceSnapshot,
} from "@/core/persistence/serialize";
import {
  clearWorkspaceFromIdb,
  putWorkspaceLines,
  replaceWorkspaceInIdb,
  updateWorkspaceMetaInIdb,
} from "@/core/persistence/progress-store";
import { removeGlossaryFromIdb, saveGlossaryToIdb } from "@/core/persistence/glossary-store";
import { clearPendingMirror, writePendingMirror } from "@/core/persistence/pending-mirror";
import { hydratePersistence } from "@/core/persistence/hydrate";
import {
  buildRowIndexMap,
  countFromIndex,
  reindexOne,
  sameRowIndex,
  type RowIndex,
} from "@/core/persistence/row-index";
import { inspectTerminology, type TerminologyIssue } from "@/core/glossary/matcher";
import type { NormalizedGlossary } from "@/core/glossary/loader";
import {
  clearGlossaryAuthoringRecovery,
  createNewGlossaryAuthoringSession,
  exportGlossaryAuthoringSession,
  importGlossaryAuthoringSession,
  isGlossaryAuthoringSessionDirty,
  loadGlossaryAuthoringRecovery,
  openGlossaryAuthoringSession,
  saveGlossaryAuthoringRecovery,
  saveGlossaryAuthoringSession,
  updateGlossaryAuthoringSession,
  type GlossaryAuthoringSession,
} from "@/core/glossary/authoring-session";
import type { GlossaryDraft } from "@/core/glossary/draft";
import {
  removeFromGlossaryLibrary,
  setGlossaryLibraryEnabled,
  upsertGlossaryLibrary,
  type StoredGlossary,
} from "@/core/glossary/library-persistence";
import { codeFromFilename, normalizeProjectCode } from "@/core/mt/target-language";
import {
  getAllProviders,
  getDefaultProviderId,
  setSettingsResolver,
  translateWithProvider,
} from "@/core/mt/providers";
import { resolveProviderSettings } from "@/core/mt/provider-settings";
import { sourceText } from "@/core/lang/status";
import { validateEnglishReferenceFile } from "@/core/lang/reference-validation";
import {
  downloadBlob,
  downloadText,
  formatBytes,
  gunzipToText,
  gzipText,
  readFileAsArrayBuffer,
  readFileAsText,
} from "@/lib/utils";
import { useI18n } from "@/features/i18n/I18nProvider";

export type { StoredGlossary } from "@/core/glossary/library-persistence";

setSettingsResolver(resolveProviderSettings);

const SETTINGS_STORAGE_KEY = "necesse-translator.settings.v1";
const FONT_STORAGE_KEY = "necesse-translator.font-settings.v1";
const PREFERRED_PROVIDER_KEY = "necesse-translator.preferred-mt-provider.v1";

function localBoundaryDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function glossaryExportFilename(id: string): string {
  const safe = id.trim().replace(/[^a-z0-9._-]+/gi, "-") || "glossary";
  return `${safe}.json`;
}

export interface AppSettings {
  referenceReminder: boolean;
}

export interface FontSettings {
  interfacePreset: string;
  interfaceCustom: string;
  editorPreset: string;
  editorCustom: string;
}

interface DiffOther {
  name: string;
  lines: string[];
}

interface WorkspaceState {
  isOpen: boolean;
  filename: string;
  referenceFilename: string;
  eol: "\n" | "\r\n";
  items: LangLine[];
  filter: FilterMode;
  query: string;
  view: WorkspaceView;
  reviewFilter: ReviewFilter;
  reviewQuery: string;
  spellcheck: boolean;
  autocompleteEnabled: boolean;
  mtProvider: string;
  targetLanguage: string;
  compactView: boolean;
  savedAt: number;
  saveState: "saved" | "saving" | "error";
  diffOther: DiffOther | null;
  diffOnly: boolean;
  diffMode: DiffMode;
  pendingRecovery: WorkspaceSnapshot | null;
  glossaries: StoredGlossary[];
  settings: AppSettings;
  fonts: FontSettings;
  terminologyFilterActive: boolean;
  /** False until IndexedDB hydrate finishes. */
  ready: boolean;
  /** Bumped when glossaries change so virtual lists remount with fresh heights. */
  listRevision: number;
  glossaryAuthoringSession: GlossaryAuthoringSession | null;
  glossaryAuthoringFocusToken: number;
}

interface WorkspaceContextValue extends WorkspaceState {
  openWorkspaceFromText: (
    text: string,
    options?: {
      filename?: string;
      referenceFilename?: string;
      referenceSourceText?: string;
      targetLang?: string;
    },
  ) => void;
  openLangFile: (file: File) => Promise<void>;
  createFromReferenceFile: (file: File) => Promise<void>;
  loadReferenceFile: (file: File) => Promise<void>;
  exportLang: () => void;
  saveProgressFile: () => Promise<void>;
  loadProgressFile: (file: File) => Promise<void>;
  continueRecovery: () => void;
  startOverRecovery: () => void;
  setFilename: (name: string) => void;
  setFilter: (filter: FilterMode) => void;
  setQuery: (query: string) => void;
  setView: (view: WorkspaceView) => void;
  setReviewFilter: (filter: ReviewFilter) => void;
  setReviewQuery: (query: string) => void;
  setSpellcheck: (value: boolean) => void;
  setAutocompleteEnabled: (value: boolean) => void;
  setMtProvider: (id: string) => void;
  setTargetLanguage: (code: string) => void;
  setCompactView: (enabled: boolean) => void;
  setDiffOnly: (value: boolean) => void;
  setDiffMode: (mode: DiffMode) => void;
  loadDiffFile: (file: File) => Promise<void>;
  updateEntryValue: (entryId: number, value: string, options?: { mtDraft?: boolean }) => void;
  toggleMarkedSame: (entryId: number) => void;
  translateEntry: (entryId: number) => Promise<void>;
  progress: { done: number; total: number };
  referenceAvailable: boolean;
  whitespaceIssueCount: number;
  terminologyIssueCount: number;
  enabledGlossaries: StoredGlossary[];
  terminologyIssuesFor: (entry: TranslationEntry) => readonly TerminologyIssue[];
  rowIndexes: ReadonlyMap<number, RowIndex>;
  setGlossaryEnabled: (id: string, enabled: boolean) => void;
  upsertGlossary: (glossary: NormalizedGlossary) => void;
  removeGlossary: (id: string) => void;
  createGlossaryAuthoring: () => boolean;
  importGlossaryAuthoring: (text: string, label?: string) => boolean;
  openGlossaryAuthoring: (id: string) => boolean;
  updateGlossaryAuthoring: (update: (draft: GlossaryDraft) => void) => void;
  saveGlossaryAuthoring: () => boolean;
  exportGlossaryAuthoring: () => boolean;
  closeGlossaryAuthoring: () => boolean;
  setSettings: (patch: Partial<AppSettings>) => void;
  setFonts: (patch: Partial<FontSettings>) => void;
  setTerminologyFilterActive: (active: boolean) => void;
  filteredEntries: TranslationEntry[];
  providers: ReturnType<typeof getAllProviders>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    return { referenceReminder: raw.referenceReminder !== false };
  } catch {
    return { referenceReminder: true };
  }
}

function loadFonts(): FontSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(FONT_STORAGE_KEY) || "{}");
    return {
      interfacePreset: raw.interfacePreset || "default",
      interfaceCustom: raw.interfaceCustom || "",
      editorPreset: raw.editorPreset || "default",
      editorCustom: raw.editorCustom || "",
    };
  } catch {
    return {
      interfacePreset: "default",
      interfaceCustom: "",
      editorPreset: "default",
      editorCustom: "",
    };
  }
}

function preferredProvider() {
  try {
    return localStorage.getItem(PREFERRED_PROVIDER_KEY) || getDefaultProviderId() || "google";
  } catch {
    return getDefaultProviderId() || "google";
  }
}

function applyFontCss(fonts: FontSettings) {
  const fallback =
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', sans-serif";
  const presets: Record<string, string> = {
    default: "",
    system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Noto Serif', serif",
    mono: "ui-monospace, 'JetBrains Mono', Consolas, monospace",
  };
  const stack = (preset: string, custom: string) => {
    if (preset === "custom" && custom.trim())
      return `'${custom.replace(/'/g, "\\'")}', ${fallback}`;
    return presets[preset] || "";
  };
  const interfaceStack = stack(fonts.interfacePreset, fonts.interfaceCustom);
  const editorStack = stack(fonts.editorPreset, fonts.editorCustom);
  if (interfaceStack)
    document.documentElement.style.setProperty("--user-interface-font", interfaceStack);
  else document.documentElement.style.removeProperty("--user-interface-font");
  if (editorStack) document.documentElement.style.setProperty("--user-editor-font", editorStack);
  else document.documentElement.style.removeProperty("--user-editor-font");
}

function snapshotFromState(snapshot: WorkspaceState): WorkspaceSnapshot {
  return {
    filename: snapshot.filename,
    referenceFilename: snapshot.referenceFilename,
    eol: snapshot.eol,
    savedAt: Date.now(),
    items: snapshot.items,
    meta: {
      provider: snapshot.mtProvider,
      targetLanguage: snapshot.targetLanguage,
      spellcheck: snapshot.spellcheck,
      autocompleteEnabled: snapshot.autocompleteEnabled,
    },
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyLineIds = useRef<Set<number>>(new Set());
  const fullReplace = useRef(false);
  const metaDirty = useRef(false);
  const readyRef = useRef(false);
  const writeInFlight = useRef(false);
  const rewriteRequested = useRef(false);
  const inFlightLines = useRef<number[]>([]);

  const [rowIndexes, setRowIndexes] = useState<ReadonlyMap<number, RowIndex>>(() => new Map());
  const rowIndexesRef = useRef(rowIndexes);
  rowIndexesRef.current = rowIndexes;

  const [state, setState] = useState<WorkspaceState>(() => {
    const glossaryAuthoringSession = loadGlossaryAuthoringRecovery();
    return {
      isOpen: false,
      filename: "",
      referenceFilename: "",
      eol: "\r\n",
      items: [],
      filter: "missing",
      query: "",
      view: glossaryAuthoringSession ? "terminology" : "editor",
      reviewFilter: "all",
      reviewQuery: "",
      spellcheck: true,
      autocompleteEnabled: true,
      mtProvider: preferredProvider(),
      targetLanguage: "",
      compactView: false,
      savedAt: 0,
      saveState: "saved",
      diffOther: null,
      diffOnly: true,
      diffMode: "word",
      pendingRecovery: null,
      glossaries: [],
      settings: loadSettings(),
      fonts: loadFonts(),
      terminologyFilterActive: false,
      ready: false,
      listRevision: 0,
      glossaryAuthoringSession,
      glossaryAuthoringFocusToken: 0,
    };
  });

  // Read-only mirror for handlers that have to look at the current state to
  // decide something *and* report it — a state updater is not allowed to do the
  // reporting, because React may run it more than once.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hydrated = await hydratePersistence();
        if (cancelled) return;
        readyRef.current = true;
        // Never clobber an already-open workspace — hydrate only seeds recovery.
        if (stateRef.current.isOpen) {
          setState((current) => ({
            ...current,
            glossaries: hydrated.glossaries,
            ready: true,
          }));
          return;
        }
        rowIndexesRef.current = hydrated.rowIndexes;
        setRowIndexes(hydrated.rowIndexes);
        setState((current) => ({
          ...current,
          glossaries: hydrated.glossaries,
          pendingRecovery: hydrated.pendingRecovery,
          ready: true,
        }));
      } catch {
        if (cancelled) return;
        readyRef.current = true;
        setState((current) => ({ ...current, ready: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyFontCss(state.fonts);
  }, [state.fonts]);

  useEffect(() => {
    document.documentElement.classList.toggle("compact-view", state.compactView && state.isOpen);
  }, [state.compactView, state.isOpen]);

  const markFullReplace = useCallback((indexes: Map<number, RowIndex>) => {
    fullReplace.current = true;
    dirtyLineIds.current.clear();
    metaDirty.current = true;
    // Whatever the mirror holds belongs to the workspace being replaced.
    clearPendingMirror();
    setRowIndexes(indexes);
  }, []);

  /**
   * One write pass. The pending work is claimed *before* the first `await`, so
   * edits made while the transaction is in flight stay dirty and are picked up
   * by the next pass instead of being cleared by this one; a failed write puts
   * the claim back so it is retried.
   */
  const persistOnce = useCallback(async (snapshot: WorkspaceState) => {
    const wasFullReplace = fullReplace.current;
    const wasMetaDirty = metaDirty.current;
    // A full replace writes every line of this snapshot, so it also covers the
    // rows that were dirty when it was claimed.
    const claimedLines = [...dirtyLineIds.current];
    if (!wasFullReplace && !wasMetaDirty && claimedLines.length === 0) {
      setState((current) =>
        current.saveState === "saved" ? current : { ...current, saveState: "saved" },
      );
      return true;
    }

    const indexes = rowIndexesRef.current;
    fullReplace.current = false;
    metaDirty.current = false;
    for (const id of claimedLines) dirtyLineIds.current.delete(id);
    // Claimed but not committed yet — the unload mirror still has to cover these.
    inFlightLines.current = claimedLines;

    try {
      if (wasFullReplace) {
        await replaceWorkspaceInIdb(snapshotFromState(snapshot), indexes, snapshot.glossaries);
      } else if (claimedLines.length > 0) {
        await putWorkspaceLines(snapshot.items, claimedLines, indexes, {
          filename: snapshot.filename,
          referenceFilename: snapshot.referenceFilename,
          eol: snapshot.eol,
          provider: snapshot.mtProvider,
          targetLanguage: snapshot.targetLanguage,
          spellcheck: snapshot.spellcheck,
          autocompleteEnabled: snapshot.autocompleteEnabled,
          glossaries: snapshot.glossaries,
        });
      } else {
        await updateWorkspaceMetaInIdb(
          {
            filename: snapshot.filename,
            referenceFilename: snapshot.referenceFilename,
            eol: snapshot.eol,
            provider: snapshot.mtProvider,
            targetLanguage: snapshot.targetLanguage,
            spellcheck: snapshot.spellcheck,
            autocompleteEnabled: snapshot.autocompleteEnabled,
          },
          snapshot.glossaries,
        );
      }
      inFlightLines.current = [];
      // Committed to IndexedDB — the unload safety net is no longer needed.
      if (dirtyLineIds.current.size === 0 && !fullReplace.current) clearPendingMirror();
      setState((current) => ({
        ...current,
        savedAt: Date.now(),
        saveState: "saved",
      }));
      return true;
    } catch {
      if (wasFullReplace) fullReplace.current = true;
      if (wasMetaDirty) metaDirty.current = true;
      for (const id of claimedLines) dirtyLineIds.current.add(id);
      inFlightLines.current = [];
      setState((current) => ({
        ...current,
        saveState: "error",
      }));
      return false;
    }
  }, []);

  /**
   * Serialized entry point: overlapping flushes (debounce + page-hide) would
   * otherwise interleave a full replace with line writes from a different
   * workspace. A flush requested mid-write is folded into one follow-up pass.
   */
  const persistNow = useCallback(
    async (snapshot: WorkspaceState) => {
      if (!snapshot.isOpen || !readyRef.current) return false;
      if (writeInFlight.current) {
        rewriteRequested.current = true;
        return false;
      }
      writeInFlight.current = true;
      try {
        let ok = await persistOnce(snapshot);
        while (rewriteRequested.current) {
          rewriteRequested.current = false;
          if (!stateRef.current.isOpen) break;
          ok = await persistOnce(stateRef.current);
        }
        return ok;
      } finally {
        writeInFlight.current = false;
      }
    },
    [persistOnce],
  );

  const scheduleSave = useCallback(() => {
    setState((current) => ({ ...current, saveState: "saving" }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistNow(stateRef.current);
    }, 500);
  }, [persistNow]);

  useEffect(() => {
    const flush = () => {
      const current = stateRef.current;
      if (!current.isOpen || !readyRef.current) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      // An IndexedDB transaction opened here may never commit, so the pending
      // rows go to localStorage synchronously first. A pending full replace is
      // not mirrored: it is a freshly opened file, re-openable by hand, and
      // mirroring it whole is exactly the quota problem IndexedDB solved.
      const unsaved = new Set([...dirtyLineIds.current, ...inFlightLines.current]);
      if (!fullReplace.current && unsaved.size > 0) {
        writePendingMirror(current.filename, current.items, unsaved);
      }
      void persistNow(current);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [persistNow]);

  const dismissPendingRecovery = useCallback((discardStored = false) => {
    setState((current) => ({ ...current, pendingRecovery: null }));
    if (discardStored) {
      // Discarding the stored session also drops whatever was still queued for it.
      fullReplace.current = false;
      dirtyLineIds.current.clear();
      metaDirty.current = false;
      clearPendingMirror();
      void clearWorkspaceFromIdb().catch(() => {
        /* nothing to recover from a failed discard — the next save overwrites */
      });
      setRowIndexes(new Map());
    }
  }, []);

  const openWorkspaceFromText = useCallback(
    (
      text: string,
      options: {
        filename?: string;
        referenceFilename?: string;
        /** Original English reference body — applied so SAME_TRANSLATION works immediately. */
        referenceSourceText?: string;
        targetLang?: string;
      } = {},
    ) => {
      const parsed = parseLangFile(String(text ?? ""));
      if (options.referenceSourceText) {
        applyReferenceMap(parsed.items, parseReferenceLang(options.referenceSourceText));
      }
      const filename = options.filename ? cleanLangFilename(options.filename) : "";
      dismissPendingRecovery();
      const glossaries = stateRef.current.glossaries;
      markFullReplace(buildRowIndexMap(parsed.items, glossaries));
      setState((current) => ({
        ...current,
        isOpen: true,
        eol: parsed.eol,
        items: parsed.items,
        filename,
        referenceFilename: options.referenceFilename ? String(options.referenceFilename) : "",
        diffOther: null,
        mtProvider: preferredProvider(),
        targetLanguage: Object.hasOwn(options, "targetLang")
          ? String(options.targetLang || "")
          : codeFromFilename(filename),
        filter: "missing",
        query: "",
        view: "editor",
        reviewFilter: "all",
        reviewQuery: "",
        compactView: false,
        pendingRecovery: null,
      }));
      scheduleSave();
    },
    [dismissPendingRecovery, markFullReplace, scheduleSave],
  );

  const openLangFile = useCallback(
    async (file: File) => {
      const text = await readFileAsText(file);
      openWorkspaceFromText(text, { filename: file.name });
      toast.success(t("toast.fileLoaded"));
    },
    [openWorkspaceFromText, t],
  );

  const createFromReferenceFile = useCallback(
    async (file: File) => {
      const text = await readFileAsText(file);
      const validation = validateEnglishReferenceFile(file.name, text);
      if (!validation.ok) {
        toast.error(t(validation.messageKey));
        return;
      }
      const result = createTranslationFromReference(text, validation.filename);
      if (!result.entryCount) {
        toast.error(t("err.newTranslationNoEntries"));
        return;
      }
      // Apply the same English body as the live reference so SAME_TRANSLATION
      // and the reminder button settle in one frame — no pulse flash.
      openWorkspaceFromText(result.text, {
        filename: "",
        referenceFilename: validation.filename,
        referenceSourceText: text,
        targetLang: "",
      });
      toast.success(
        t("toast.newTranslationCreated", {
          file: validation.filename,
          n: result.entryCount,
        }),
      );
    },
    [openWorkspaceFromText, t],
  );

  const loadReferenceFile = useCallback(
    async (file: File) => {
      const text = await readFileAsText(file);
      const validation = validateEnglishReferenceFile(file.name, text);
      if (!validation.ok) {
        toast.error(t(validation.messageKey));
        return;
      }
      const map = parseReferenceLang(text);
      // Applied outside the updater: how many entries matched is worth telling
      // the user, and a toast fired from inside would be repeated every time
      // React re-ran the updater — three times, in practice.
      const items = stateRef.current.items.map((item) => ({ ...item }));
      const matched = applyReferenceMap(items, map);
      markFullReplace(buildRowIndexMap(items, stateRef.current.glossaries));
      setState((current) => ({
        ...current,
        items,
        referenceFilename: validation.filename,
      }));
      toast.success(t("btn.enRefLoaded", { file: validation.filename, n: matched }));
      scheduleSave();
    },
    [markFullReplace, scheduleSave, t],
  );

  const exportLang = useCallback(() => {
    setState((current) => {
      let name = current.filename.trim();
      if (!name) {
        toast.error(t("err.targetFilenameRequired"));
        return current;
      }
      if (!/\.lang$/i.test(name)) name += ".lang";
      downloadText(name, buildLangFile(current.items, current.eol));
      toast.success(t("toast.exported", { name }));
      return { ...current, filename: name };
    });
  }, [t]);

  const saveProgressFile = useCallback(async () => {
    const snapshot = serializeProgress(snapshotFromState(state));
    const base = (state.filename || "translation.lang").replace(/\.lang$/i, "");
    const text = JSON.stringify(snapshot);
    if (typeof CompressionStream !== "undefined") {
      try {
        const blob = await gzipText(text);
        downloadBlob(`${base}.progress.json.gz`, blob);
        toast.success(
          t("toast.progressSavedGz", {
            size: formatBytes(blob.size),
            raw: formatBytes(text.length),
          }),
        );
        return;
      } catch {
        /* fall through */
      }
    }
    downloadText(`${base}.progress.json`, text, "application/json");
    toast.success(t("toast.progressSaved", { size: formatBytes(text.length) }));
  }, [state, t]);

  const loadProgressFile = useCallback(
    async (file: File) => {
      try {
        let text: string;
        if (/\.gz$/i.test(file.name) || file.type === "application/gzip") {
          text = await gunzipToText(await readFileAsArrayBuffer(file));
        } else {
          text = await readFileAsText(file);
        }
        const snapshot = deserializeProgress(JSON.parse(text));
        dismissPendingRecovery();
        markFullReplace(buildRowIndexMap(snapshot.items, stateRef.current.glossaries));
        setState((current) => ({
          ...current,
          isOpen: true,
          filename: snapshot.filename,
          referenceFilename: snapshot.referenceFilename,
          eol: snapshot.eol,
          items: snapshot.items,
          savedAt: snapshot.savedAt,
          mtProvider: snapshot.meta.provider || preferredProvider(),
          targetLanguage: snapshot.meta.targetLanguage || codeFromFilename(snapshot.filename),
          spellcheck: snapshot.meta.spellcheck,
          autocompleteEnabled: snapshot.meta.autocompleteEnabled,
          view: "editor",
          filter: "missing",
          pendingRecovery: null,
        }));
        scheduleSave();
        toast.success(t("toast.progressRestored"));
      } catch (error) {
        toast.error(
          t("err.readFile", { msg: error instanceof Error ? error.message : t("err.generic") }),
        );
      }
    },
    [dismissPendingRecovery, markFullReplace, scheduleSave, t],
  );

  const continueRecovery = useCallback(() => {
    const recovery = state.pendingRecovery;
    if (!recovery) return;
    markFullReplace(buildRowIndexMap(recovery.items, stateRef.current.glossaries));
    setState((current) => ({
      ...current,
      isOpen: true,
      filename: recovery.filename,
      referenceFilename: recovery.referenceFilename,
      eol: recovery.eol,
      items: recovery.items,
      savedAt: recovery.savedAt,
      mtProvider: recovery.meta.provider || preferredProvider(),
      targetLanguage: recovery.meta.targetLanguage || codeFromFilename(recovery.filename),
      spellcheck: recovery.meta.spellcheck,
      autocompleteEnabled: recovery.meta.autocompleteEnabled,
      pendingRecovery: null,
      view: "editor",
    }));
    scheduleSave();
  }, [markFullReplace, scheduleSave, state.pendingRecovery]);

  const startOverRecovery = useCallback(() => {
    dismissPendingRecovery(true);
  }, [dismissPendingRecovery]);

  const updateEntryValue = useCallback(
    (entryId: number, value: string, options?: { mtDraft?: boolean }) => {
      const current = stateRef.current;
      const items = current.items.map((item) =>
        item.type === "entry" && item.id === entryId
          ? {
              ...item,
              value,
              touched: true,
              mtDraft: options?.mtDraft ?? false,
            }
          : item,
      );
      const entry = items.find(
        (item): item is TranslationEntry => item.type === "entry" && item.id === entryId,
      );
      if (entry) {
        const next = new Map(rowIndexesRef.current);
        const nextIndex = reindexOne(next, entry, current.glossaries);
        const prevIndex = rowIndexesRef.current.get(entryId);
        rowIndexesRef.current = next;
        dirtyLineIds.current.add(entryId);
        // Only publish a new Map when filter-relevant flags change — otherwise the
        // virtual list rebuilds and measure() snaps the scroll mid-fling.
        if (!sameRowIndex(prevIndex, nextIndex)) setRowIndexes(next);
      }
      setState((prev) => ({ ...prev, items }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const toggleMarkedSame = useCallback(
    (entryId: number) => {
      const current = stateRef.current;
      const items = current.items.map((item) =>
        item.type === "entry" && item.id === entryId && item.ref != null
          ? { ...item, markedSame: !item.markedSame, touched: true }
          : item,
      );
      const entry = items.find(
        (item): item is TranslationEntry => item.type === "entry" && item.id === entryId,
      );
      if (entry) {
        const next = new Map(rowIndexesRef.current);
        reindexOne(next, entry, current.glossaries);
        rowIndexesRef.current = next;
        setRowIndexes(next);
        dirtyLineIds.current.add(entryId);
      }
      setState((prev) => ({ ...prev, items }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const translateEntry = useCallback(
    async (entryId: number) => {
      const entry = state.items.find(
        (item): item is TranslationEntry => item.type === "entry" && item.id === entryId,
      );
      if (!entry) return;
      const target = normalizeProjectCode(state.targetLanguage);
      if (!target) {
        toast.error(t("mt.langTitle"));
        return;
      }
      const source = sourceText(entry);
      if (!String(source).trim()) {
        toast.error(t("mt.emptySrc"));
        return;
      }
      try {
        const suggestion = await translateWithProvider(state.mtProvider, {
          text: source,
          targetLanguage: target,
          sourceLanguage: "en",
        });
        if (suggestion.trim()) updateEntryValue(entryId, suggestion, { mtDraft: true });
      } catch (error) {
        toast.error(
          t("mt.prefix", { msg: error instanceof Error ? error.message : t("err.generic") }),
        );
      }
    },
    [state.items, state.mtProvider, state.targetLanguage, t, updateEntryValue],
  );

  const loadDiffFile = useCallback(async (file: File) => {
    const text = await readFileAsText(file);
    const lines = text.split(/\r\n|\n/);
    setState((current) => ({
      ...current,
      diffOther: { name: file.name, lines },
      view: "diff",
    }));
  }, []);

  const reindexAllGlossaries = useCallback(
    (glossaries: StoredGlossary[]) => {
      setState((current) => ({ ...current, listRevision: current.listRevision + 1 }));
      if (!stateRef.current.isOpen) return;

      const previous = rowIndexesRef.current;
      const next = buildRowIndexMap(stateRef.current.items, glossaries);
      // A glossary toggle usually moves a handful of rows out of tens of
      // thousands, so rewrite those rather than the whole workspace. The meta
      // record is dirty either way — it carries the glossary fingerprint.
      for (const [id, row] of next) {
        if (!sameRowIndex(previous.get(id), row)) dirtyLineIds.current.add(id);
      }
      metaDirty.current = true;
      rowIndexesRef.current = next;
      setRowIndexes(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  /** Persist one glossary library change; state, storage and index in one place. */
  const commitGlossaryLibrary = useCallback(
    (glossaries: StoredGlossary[], write: () => Promise<unknown>) => {
      setState((current) => ({ ...current, glossaries }));
      void write().catch((error: unknown) => {
        toast.error(
          t("glossary.authoringSaveFailed", {
            msg: error instanceof Error ? error.message : t("err.generic"),
          }),
        );
      });
      reindexAllGlossaries(glossaries);
    },
    [reindexAllGlossaries, t],
  );

  const canReplaceGlossaryAuthoring = useCallback(() => {
    const session = stateRef.current.glossaryAuthoringSession;
    return (
      !session ||
      !isGlossaryAuthoringSessionDirty(session) ||
      window.confirm(t("glossary.authoringDiscardConfirm"))
    );
  }, [t]);

  const focusGlossaryAuthoring = useCallback((session: GlossaryAuthoringSession) => {
    saveGlossaryAuthoringRecovery(session);
    setState((current) => ({
      ...current,
      view: "terminology",
      glossaryAuthoringSession: session,
      glossaryAuthoringFocusToken: current.glossaryAuthoringFocusToken + 1,
    }));
  }, []);

  const createGlossaryAuthoring = useCallback(() => {
    if (!canReplaceGlossaryAuthoring()) return false;
    focusGlossaryAuthoring(createNewGlossaryAuthoringSession());
    return true;
  }, [canReplaceGlossaryAuthoring, focusGlossaryAuthoring]);

  const importGlossaryAuthoring = useCallback(
    (text: string, label = "glossary") => {
      if (!canReplaceGlossaryAuthoring()) return false;
      try {
        focusGlossaryAuthoring(importGlossaryAuthoringSession(text, label));
        return true;
      } catch (error) {
        toast.error(
          t("glossary.authoringImportFailed", {
            msg: error instanceof Error ? error.message : t("err.generic"),
          }),
        );
        return false;
      }
    },
    [canReplaceGlossaryAuthoring, focusGlossaryAuthoring, t],
  );

  const openGlossaryAuthoring = useCallback(
    (id: string) => {
      if (!canReplaceGlossaryAuthoring()) return false;
      const glossary = stateRef.current.glossaries.find((item) => item.id === id);
      if (!glossary) return false;
      focusGlossaryAuthoring(openGlossaryAuthoringSession(glossary));
      return true;
    },
    [canReplaceGlossaryAuthoring, focusGlossaryAuthoring],
  );

  const updateGlossaryAuthoring = useCallback((update: (draft: GlossaryDraft) => void) => {
    setState((current) => {
      if (!current.glossaryAuthoringSession) return current;
      const session = updateGlossaryAuthoringSession(current.glossaryAuthoringSession, update);
      saveGlossaryAuthoringRecovery(session);
      return { ...current, glossaryAuthoringSession: session };
    });
  }, []);

  const saveGlossaryAuthoring = useCallback(() => {
    const current = stateRef.current;
    if (!current.glossaryAuthoringSession) return false;
    try {
      const result = saveGlossaryAuthoringSession(
        current.glossaryAuthoringSession,
        localBoundaryDate(),
      );
      const glossaries = upsertGlossaryLibrary(current.glossaries, result.glossary);
      const updated = glossaries.find((item) => item.id === result.glossary.id);
      commitGlossaryLibrary(glossaries, () =>
        updated ? saveGlossaryToIdb(updated) : Promise.resolve(),
      );
      saveGlossaryAuthoringRecovery(result.session);
      setState((state) => ({
        ...state,
        glossaryAuthoringSession: result.session,
      }));
      toast.success(t("glossary.authoringSaved", { name: result.glossary.name }));
      return true;
    } catch (error) {
      toast.error(
        t("glossary.authoringSaveFailed", {
          msg: error instanceof Error ? error.message : t("err.generic"),
        }),
      );
      return false;
    }
  }, [commitGlossaryLibrary, t]);

  const exportGlossaryAuthoring = useCallback(() => {
    const current = stateRef.current;
    if (!current.glossaryAuthoringSession) return false;
    try {
      const result = exportGlossaryAuthoringSession(
        current.glossaryAuthoringSession,
        localBoundaryDate(),
      );
      downloadText(
        glossaryExportFilename(result.glossary.id),
        result.serialized,
        "application/json",
      );
      saveGlossaryAuthoringRecovery(result.session);
      setState((state) => ({ ...state, glossaryAuthoringSession: result.session }));
      toast.success(t("glossary.authoringExported", { name: result.glossary.name }));
      return true;
    } catch (error) {
      toast.error(
        t("glossary.authoringExportFailed", {
          msg: error instanceof Error ? error.message : t("err.generic"),
        }),
      );
      return false;
    }
  }, [t]);

  const closeGlossaryAuthoring = useCallback(() => {
    if (!canReplaceGlossaryAuthoring()) return false;
    clearGlossaryAuthoringRecovery();
    setState((current) => ({ ...current, glossaryAuthoringSession: null }));
    return true;
  }, [canReplaceGlossaryAuthoring]);

  const enabledGlossaries = useMemo(
    () => state.glossaries.filter((glossary) => glossary.enabled),
    [state.glossaries],
  );

  const terminologyIssuesFor = useCallback(
    (entry: TranslationEntry) =>
      inspectTerminology(sourceText(entry), entry.value, enabledGlossaries),
    [enabledGlossaries],
  );

  const entries = useMemo(
    () => state.items.filter((item): item is TranslationEntry => item.type === "entry"),
    [state.items],
  );

  const filteredEntries = useMemo(() => {
    const query = state.query.trim().toLowerCase();
    return entries.filter((entry) => {
      const indexed = rowIndexes.get(entry.id);
      if (state.terminologyFilterActive) {
        // Terminology tab — only rows with terminology issues.
        if (!indexed?.glossaryIssue) return false;
      } else if (state.filter === "ws") {
        // Whitespaces tab — only rows with whitespace issues.
        if (!indexed?.wsIssue) return false;
        // All other tabs — only rows with the selected status.
      } else if (state.filter !== "all" && indexed?.status !== state.filter) {
        return false;
      }
      if (query) {
        const haystack =
          `${entry.key}\n${entry.value}\n${entry.english}\n${entry.ref || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [entries, rowIndexes, state.filter, state.query, state.terminologyFilterActive]);

  const indexCounts = useMemo(() => countFromIndex(rowIndexes), [rowIndexes]);
  const progress = useMemo(
    () => ({ done: indexCounts.done, total: indexCounts.total }),
    [indexCounts],
  );
  const referenceAvailable = useMemo(
    () => hasUsableReference(state.items, state.referenceFilename),
    [state.items, state.referenceFilename],
  );
  const whitespaceIssueCount = indexCounts.wsIssues;
  const terminologyIssueCount = indexCounts.glossaryIssues;

  const value: WorkspaceContextValue = {
    ...state,
    openWorkspaceFromText,
    openLangFile,
    createFromReferenceFile,
    loadReferenceFile,
    exportLang,
    saveProgressFile,
    loadProgressFile,
    continueRecovery,
    startOverRecovery,
    setFilename: (name) => {
      setState((current) => ({ ...current, filename: name }));
      metaDirty.current = true;
      scheduleSave();
    },
    setFilter: (filter) => setState((current) => ({ ...current, filter })),
    setQuery: (query) => setState((current) => ({ ...current, query })),
    setView: (view) => setState((current) => ({ ...current, view })),
    setReviewFilter: (reviewFilter) => setState((current) => ({ ...current, reviewFilter })),
    setReviewQuery: (reviewQuery) => setState((current) => ({ ...current, reviewQuery })),
    setSpellcheck: (spellcheck) => {
      setState((current) => ({ ...current, spellcheck }));
      metaDirty.current = true;
      scheduleSave();
    },
    setAutocompleteEnabled: (autocompleteEnabled) => {
      setState((current) => ({ ...current, autocompleteEnabled }));
      metaDirty.current = true;
      scheduleSave();
    },
    setMtProvider: (mtProvider) => {
      try {
        localStorage.setItem(PREFERRED_PROVIDER_KEY, mtProvider);
      } catch {
        /* ignore */
      }
      setState((current) => ({ ...current, mtProvider }));
      metaDirty.current = true;
      scheduleSave();
    },
    setTargetLanguage: (targetLanguage) => {
      setState((current) => ({ ...current, targetLanguage: normalizeProjectCode(targetLanguage) }));
      metaDirty.current = true;
      scheduleSave();
    },
    setCompactView: (compactView) =>
      setState((current) => ({ ...current, compactView: compactView && current.isOpen })),
    setDiffOnly: (diffOnly) => setState((current) => ({ ...current, diffOnly })),
    setDiffMode: (diffMode) => setState((current) => ({ ...current, diffMode })),
    loadDiffFile,
    updateEntryValue,
    toggleMarkedSame,
    translateEntry,
    progress,
    referenceAvailable,
    whitespaceIssueCount,
    terminologyIssueCount,
    enabledGlossaries,
    terminologyIssuesFor,
    rowIndexes,
    // Storage writes stay out of the state updaters: React runs those more than
    // once (StrictMode does it on every change), and a write is not repeatable.
    setGlossaryEnabled: (id, enabled) => {
      const glossaries = setGlossaryLibraryEnabled(stateRef.current.glossaries, id, enabled);
      const updated = glossaries.find((glossary) => glossary.id === id);
      commitGlossaryLibrary(glossaries, () =>
        updated ? saveGlossaryToIdb(updated) : Promise.resolve(),
      );
    },
    upsertGlossary: (glossary) => {
      const glossaries = upsertGlossaryLibrary(stateRef.current.glossaries, glossary);
      const updated = glossaries.find((item) => item.id === glossary.id);
      commitGlossaryLibrary(glossaries, () =>
        updated ? saveGlossaryToIdb(updated) : Promise.resolve(),
      );
    },
    removeGlossary: (id) => {
      const glossaries = removeFromGlossaryLibrary(stateRef.current.glossaries, id);
      commitGlossaryLibrary(glossaries, () => removeGlossaryFromIdb(id));
    },
    createGlossaryAuthoring,
    importGlossaryAuthoring,
    openGlossaryAuthoring,
    updateGlossaryAuthoring,
    saveGlossaryAuthoring,
    exportGlossaryAuthoring,
    closeGlossaryAuthoring,
    setSettings: (patch) => {
      setState((current) => {
        const settings = { ...current.settings, ...patch };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        return { ...current, settings };
      });
    },
    setFonts: (patch) => {
      setState((current) => {
        const fonts = { ...current.fonts, ...patch };
        localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(fonts));
        return { ...current, fonts };
      });
    },
    setTerminologyFilterActive: (terminologyFilterActive) =>
      setState((current) => ({ ...current, terminologyFilterActive })),
    filteredEntries,
    providers: getAllProviders(),
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
