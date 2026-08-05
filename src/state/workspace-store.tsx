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
import {
  removeGlossaryFromIdb,
  saveGlossaryToIdb,
  type StoredGlossary,
} from "@/core/persistence/glossary-store";
import { hydratePersistence } from "@/core/persistence/hydrate";
import {
  buildRowIndexMap,
  countFromIndex,
  reindexOne,
  type RowIndex,
} from "@/core/persistence/row-index";
import { inspectTerminology, type TerminologyIssue } from "@/core/glossary/matcher";
import type { NormalizedGlossary } from "@/core/glossary/loader";
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

export type { StoredGlossary } from "@/core/persistence/glossary-store";

setSettingsResolver(resolveProviderSettings);

const SETTINGS_STORAGE_KEY = "necesse-translator.settings.v1";
const FONT_STORAGE_KEY = "necesse-translator.font-settings.v1";
const PREFERRED_PROVIDER_KEY = "necesse-translator.preferred-mt-provider.v1";

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

  const [rowIndexes, setRowIndexes] = useState<ReadonlyMap<number, RowIndex>>(() => new Map());
  const rowIndexesRef = useRef(rowIndexes);
  rowIndexesRef.current = rowIndexes;

  const [state, setState] = useState<WorkspaceState>(() => ({
    isOpen: false,
    filename: "",
    referenceFilename: "",
    eol: "\r\n",
    items: [],
    filter: "missing",
    query: "",
    view: "editor",
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
  }));

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
    setRowIndexes(indexes);
  }, []);

  const persistNow = useCallback(async (snapshot: WorkspaceState) => {
    if (!snapshot.isOpen || !readyRef.current) return false;
    const indexes = rowIndexesRef.current;
    try {
      if (fullReplace.current) {
        await replaceWorkspaceInIdb(snapshotFromState(snapshot), indexes, snapshot.glossaries);
        fullReplace.current = false;
        dirtyLineIds.current.clear();
        metaDirty.current = false;
      } else if (dirtyLineIds.current.size > 0) {
        const dirty = [...dirtyLineIds.current];
        await putWorkspaceLines(snapshot.items, dirty, indexes, {
          filename: snapshot.filename,
          referenceFilename: snapshot.referenceFilename,
          eol: snapshot.eol,
          provider: snapshot.mtProvider,
          targetLanguage: snapshot.targetLanguage,
          spellcheck: snapshot.spellcheck,
          autocompleteEnabled: snapshot.autocompleteEnabled,
          glossaries: snapshot.glossaries,
        });
        dirtyLineIds.current.clear();
        metaDirty.current = false;
      } else if (metaDirty.current) {
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
        metaDirty.current = false;
      }
      setState((current) => ({
        ...current,
        savedAt: Date.now(),
        saveState: "saved",
      }));
      return true;
    } catch {
      setState((current) => ({
        ...current,
        saveState: "error",
      }));
      return false;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    setState((current) => ({ ...current, saveState: "saving" }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistNow(stateRef.current);
    }, 500);
  }, [persistNow]);

  useEffect(() => {
    const flush = () => {
      if (stateRef.current.isOpen) void persistNow(stateRef.current);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    return () => window.removeEventListener("pagehide", flush);
  }, [persistNow]);

  const dismissPendingRecovery = useCallback((discardStored = false) => {
    setState((current) => ({ ...current, pendingRecovery: null }));
    if (discardStored) {
      void clearWorkspaceFromIdb();
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
        if (
          !prevIndex ||
          prevIndex.status !== nextIndex.status ||
          prevIndex.tokenIssue !== nextIndex.tokenIssue ||
          prevIndex.wsIssue !== nextIndex.wsIssue ||
          prevIndex.glossaryIssue !== nextIndex.glossaryIssue ||
          prevIndex.hasRef !== nextIndex.hasRef
        ) {
          setRowIndexes(next);
        }
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
        // Terminology is an exclusive view over all rows — ignore status filters.
        if (!(indexed?.glossaryIssue ?? false)) return false;
      } else {
        const status = indexed?.status;
        if (state.filter === "missing" && status !== "missing") return false;
        if (state.filter === "done" && status !== "done") return false;
        if (state.filter === "same" && status !== "same") return false;
        if (state.filter === "ws" && !(indexed?.wsIssue ?? false)) return false;
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

  const reindexAllGlossaries = useCallback(
    (glossaries: StoredGlossary[]) => {
      if (!stateRef.current.isOpen) {
        setState((current) => ({ ...current, listRevision: current.listRevision + 1 }));
        return;
      }
      const next = buildRowIndexMap(stateRef.current.items, glossaries);
      markFullReplace(next);
      setState((current) => ({ ...current, listRevision: current.listRevision + 1 }));
      scheduleSave();
    },
    [markFullReplace, scheduleSave],
  );

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
    setGlossaryEnabled: (id, enabled) => {
      setState((current) => {
        const glossaries = current.glossaries.map((glossary) =>
          glossary.id === id ? { ...glossary, enabled } : glossary,
        );
        const updated = glossaries.find((glossary) => glossary.id === id);
        if (updated) void saveGlossaryToIdb(updated);
        queueMicrotask(() => reindexAllGlossaries(glossaries));
        return { ...current, glossaries };
      });
    },
    upsertGlossary: (glossary) => {
      setState((current) => {
        const existing = current.glossaries.find((item) => item.id === glossary.id);
        const next: StoredGlossary = {
          ...glossary,
          enabled: existing?.enabled ?? true,
        };
        const glossaries = existing
          ? current.glossaries.map((item) => (item.id === glossary.id ? next : item))
          : [...current.glossaries, next];
        void saveGlossaryToIdb(next);
        queueMicrotask(() => reindexAllGlossaries(glossaries));
        return { ...current, glossaries };
      });
    },
    removeGlossary: (id) => {
      setState((current) => {
        const glossaries = current.glossaries.filter((glossary) => glossary.id !== id);
        void removeGlossaryFromIdb(id);
        queueMicrotask(() => reindexAllGlossaries(glossaries));
        return { ...current, glossaries };
      });
    },
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
