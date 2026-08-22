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

import {
  cleanDownloadedFilename,
  REFERENCE_ROLE,
  TRANSLATION_ROLE,
  type GameLoader,
  type TranslationDocument,
} from "@mgt/sdk";
import { auxRoleOf, resolveFileLoader, resolveGameLoader } from "@/state/loaders";
import type { DiffMode, FilterMode, ReviewFilter, WorkspaceView } from "@/core/lang/markers";
import { normalizeSearchQuery } from "@/core/lang/search-query";
import {
  buildWorkspaceEntries,
  buildWorkspaceLines,
  buildWorkspaceRowIndex,
  countFromIndex,
  exportedText,
  findWorkspaceEntry,
  hasUsableReference,
  reindexWorkspaceEntry,
  sameRowIndex,
  toggleEntryMarkedSame,
  updateEntryTarget,
  type RowIndex,
  type WorkspaceEntry,
  type WorkspaceLine,
} from "@/state/entries";
import {
  deserializeProgressV3,
  serializeProgressV3,
  type ProgressDocumentV3,
} from "@/core/persistence/serialize";
import {
  clearWorkspaceDocument,
  loadWorkspaceDocument,
  saveWorkspaceDocument,
} from "@/core/persistence/document-store";
import type { WorkspaceDocumentRecord, WorkspaceUiFlags } from "@/core/persistence/idb";
import { removeGlossaryFromIdb, saveGlossaryToIdb } from "@/core/persistence/glossary-store";
import { migrateGlossariesFromLocalStorage } from "@/core/persistence/glossary-store";
import {
  inspectTerminology,
  matchingTerminologyRules,
  type TerminologyIssue,
  type TerminologyRuleMatch,
} from "@/core/glossary/matcher";
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

/**
 * Placeholder before any workspace is open — never shown, no entries to act
 * on yet. gameLoaderId must be a loader guaranteed to be registered
 * regardless of mod-catalog outcomes — resolveGameLoader() runs
 * synchronously on the very first render, before bootstrapMods()'s catalog
 * fetch is known to have succeeded. generic-ini is always statically
 * registered (see mod-bootstrap.ts);
 */
const EMPTY_DOCUMENT: TranslationDocument = {
  gameLoaderId: "generic-ini",
  fileLoaderId: "ini",
  sourceLocale: "en",
  targetLocale: "",
  nodes: [],
  formatMeta: { eol: "\r\n", trailingNewline: false },
  gameMeta: {},
};

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

export type FlowStage = "select-game" | "dropzone" | "editor";

interface WorkspaceState {
  isOpen: boolean;
  /** Chosen on the game-selection screen, before any file is opened. Kept in sync with document.gameLoaderId for the workspace's whole lifetime (see applyOpenedDocument/applyStoredRecord) — AppHeader's "open another file"/"load reference" actions need to know the active loader even once isOpen is true. */
  selectedGameLoaderId: string | null;
  filename: string;
  referenceFilename: string;
  document: TranslationDocument;
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
  /** True while a picked/dropped file is being read and parsed. */
  isImportingFile: boolean;
  /** Interleaved section/entry stream the editor groups its virtual list by. */
  lines: WorkspaceLine[];
  /** Flat entry list, in document order. */
  entries: WorkspaceEntry[];
  /** "editor" also covers the pre-open Terminology tab — same quirk as today's showWorkspace check. */
  flowStage: FlowStage;
  /** The active loader, memoized on document.gameLoaderId — resolveGameLoader() throws if the id is unknown, so this stays cheap to call from render. */
  activeLoader: GameLoader;
  selectGameLoader: (id: string) => void;
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
  openWorkspaceFiles: (files: Record<string, File>) => Promise<void>;
  createFromReferenceFile: (file: File) => Promise<void>;
  loadReferenceFile: (file: File) => Promise<void>;
  /** Drops the open document (and its persisted record) back to the game-selection screen. Does not save anything — callers must offer that first. */
  closeWorkspace: () => void;
  exportLang: () => void;
  saveProgressFile: () => Promise<void>;
  loadProgressFile: (file: File) => Promise<void>;
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
  updateEntryValue: (entryId: string, value: string, options?: { mtDraft?: boolean }) => void;
  toggleMarkedSame: (entryId: string) => void;
  translateEntry: (entryId: string) => Promise<void>;
  progress: { done: number; total: number };
  referenceAvailable: boolean;
  whitespaceIssueCount: number;
  terminologyIssueCount: number;
  enabledGlossaries: StoredGlossary[];
  terminologyIssuesFor: (entry: WorkspaceEntry) => readonly TerminologyIssue[];
  terminologyMatchesFor: (entry: WorkspaceEntry) => readonly TerminologyRuleMatch[];
  rowIndexes: ReadonlyMap<string, RowIndex>;
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
  filteredEntries: WorkspaceEntry[];
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

function recordFromState(
  snapshot: WorkspaceState,
  uiFlags: ReadonlyMap<string, WorkspaceUiFlags>,
): WorkspaceDocumentRecord {
  return {
    document: snapshot.document,
    uiFlags: Object.fromEntries(uiFlags),
    filename: snapshot.filename,
    referenceFilename: snapshot.referenceFilename,
    view: snapshot.view,
    savedAt: Date.now(),
    provider: snapshot.mtProvider,
    spellcheck: snapshot.spellcheck,
    autocompleteEnabled: snapshot.autocompleteEnabled,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const writeInFlight = useRef(false);
  const rewriteRequested = useRef(false);
  /** UI-only state per entry (not loader data) — keyed by the entry's stable SDK id. */
  const entryUiFlagsRef = useRef<Map<string, WorkspaceUiFlags>>(new Map());

  const [rowIndexes, setRowIndexes] = useState<ReadonlyMap<string, RowIndex>>(() => new Map());
  const rowIndexesRef = useRef(rowIndexes);
  rowIndexesRef.current = rowIndexes;

  const [state, setState] = useState<WorkspaceState>(() => {
    const glossaryAuthoringSession = loadGlossaryAuthoringRecovery();
    return {
      isOpen: false,
      selectedGameLoaderId: null,
      filename: "",
      referenceFilename: "",
      document: EMPTY_DOCUMENT,
      filter: "missing",
      query: "",
      // A lingering unsaved glossary draft must not hijack the initial screen
      // on every reload — it stays fully intact either way, the user just
      // navigates to Terminology themselves when they want it.
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

  // Transient UI flag, not part of the persisted state: true while a picked
  // file is being read/parsed, so pickers can show a spinner instead of
  // appearing to hang on large files.
  const [isImportingFile, setIsImportingFile] = useState(false);

  // On small files the read/parse below finishes inside a single frame, so the
  // spinner would flash on and off without visibly rotating. Holding it up for
  // at least this long keeps it perceivable without slowing large files down
  // (they already run well past this floor).
  const runWithImportSpinner = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setIsImportingFile(true);
    const startedAt = Date.now();
    try {
      return await task();
    } finally {
      const elapsed = Date.now() - startedAt;
      const MIN_SPINNER_MS = 320;
      if (elapsed < MIN_SPINNER_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPINNER_MS - elapsed));
      }
      setIsImportingFile(false);
    }
  }, []);

  useEffect(() => {
    applyFontCss(state.fonts);
  }, [state.fonts]);

  useEffect(() => {
    document.documentElement.classList.toggle("compact-view", state.compactView && state.isOpen);
  }, [state.compactView, state.isOpen]);

  /** One write pass — every save now replaces the single stored document record whole. */
  const persistOnce = useCallback(async (snapshot: WorkspaceState) => {
    if (!snapshot.isOpen) return true;
    try {
      await saveWorkspaceDocument(recordFromState(snapshot, entryUiFlagsRef.current));
      setState((current) => ({ ...current, savedAt: Date.now(), saveState: "saved" }));
      return true;
    } catch {
      setState((current) => ({ ...current, saveState: "error" }));
      return false;
    }
  }, []);

  /**
   * Serialized entry point: overlapping flushes (debounce + page-hide) would
   * otherwise interleave two writes from a different workspace. A flush
   * requested mid-write is folded into one follow-up pass.
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
      // IndexedDB is async and a transaction opened here may never commit
      // before the page goes away — accepted risk (see M4 plan, Decision 2):
      // no delta mirror anymore, just best-effort immediate flush.
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

  const applyOpenedDocument = useCallback(
    (
      document: TranslationDocument,
      meta: { filename: string; referenceFilename: string; targetLanguage: string },
    ) => {
      entryUiFlagsRef.current = new Map();
      const loader = resolveGameLoader(document.gameLoaderId);
      const entries = buildWorkspaceEntries(document, entryUiFlagsRef.current);
      const indexes = buildWorkspaceRowIndex(entries, loader, stateRef.current.glossaries);
      setRowIndexes(indexes);
      rowIndexesRef.current = indexes;
      setState((current) => ({
        ...current,
        isOpen: true,
        selectedGameLoaderId: document.gameLoaderId,
        document,
        filename: meta.filename,
        referenceFilename: meta.referenceFilename,
        diffOther: null,
        mtProvider: preferredProvider(),
        targetLanguage: meta.targetLanguage,
        filter: "missing",
        query: "",
        view: "editor",
        reviewFilter: "all",
        reviewQuery: "",
        compactView: false,
      }));
      scheduleSave();
    },
    [scheduleSave],
  );

  /**
   * Shared by loadProgressFile and the startup hydrate effect — both restore a
   * full stored record. `glossaries` is taken explicitly rather than read from
   * `stateRef` because hydrate calls this before the freshly-fetched
   * glossaries have landed in state — reading `stateRef.current.glossaries`
   * there would silently index against an empty list.
   */
  const applyStoredRecord = useCallback(
    (record: WorkspaceDocumentRecord, glossaries: StoredGlossary[]) => {
      entryUiFlagsRef.current = new Map(Object.entries(record.uiFlags));
      const loader = resolveGameLoader(record.document.gameLoaderId);
      const entries = buildWorkspaceEntries(record.document, entryUiFlagsRef.current);
      const indexes = buildWorkspaceRowIndex(entries, loader, glossaries);
      setRowIndexes(indexes);
      rowIndexesRef.current = indexes;
      setState((current) => ({
        ...current,
        isOpen: true,
        selectedGameLoaderId: record.document.gameLoaderId,
        document: record.document,
        filename: record.filename,
        referenceFilename: record.referenceFilename,
        savedAt: record.savedAt,
        mtProvider: record.provider || preferredProvider(),
        targetLanguage:
          normalizeProjectCode(record.document.targetLocale) || codeFromFilename(record.filename),
        spellcheck: record.spellcheck,
        autocompleteEnabled: record.autocompleteEnabled,
        view: record.view,
        filter: "missing",
      }));
    },
    [],
  );

  // Restores the last saved session immediately on load — no confirmation
  // step, resuming on whatever tab was active when it was last saved.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const glossaries = await migrateGlossariesFromLocalStorage();
        const record = await loadWorkspaceDocument();
        if (cancelled) return;
        readyRef.current = true;
        // Never clobber an already-open workspace with a stale stored one.
        if (stateRef.current.isOpen) {
          setState((current) => ({ ...current, glossaries, ready: true }));
          return;
        }
        if (record) applyStoredRecord(record, glossaries);
        setState((current) => ({ ...current, glossaries, ready: true }));
      } catch {
        if (cancelled) return;
        readyRef.current = true;
        setState((current) => ({ ...current, ready: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyStoredRecord]);

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
      const loaderId = stateRef.current.selectedGameLoaderId;
      if (!loaderId) {
        throw new Error("openWorkspaceFromText called with no game loader selected");
      }
      const loader = resolveGameLoader(loaderId);
      const filename = options.filename
        ? cleanDownloadedFilename(options.filename, loader.fileExtension)
        : "";
      const targetLanguage = Object.hasOwn(options, "targetLang")
        ? String(options.targetLang || "")
        : codeFromFilename(filename);
      const files: { name: string; text: string }[] = [
        { name: filename || "translation.lang", text },
      ];
      const roles: { role: string }[] = [{ role: TRANSLATION_ROLE }];
      if (options.referenceSourceText) {
        files.push({
          name: options.referenceFilename || "en.lang",
          text: options.referenceSourceText,
        });
        // Fixed to "reference": this legacy-import option is only ever
        // exercised by Necesse today (referenceSourceText isn't called with
        // any value from src/ or tests), so there's no live caller needing
        // the generalized aux-role name.
        roles.push({ role: REFERENCE_ROLE });
      }
      const raw = resolveFileLoader(loader.fileLoaderId).parse({ files });
      const document = loader.toDocument(raw, roles, targetLanguage || "und");
      applyOpenedDocument(document, {
        filename,
        referenceFilename: options.referenceFilename ? String(options.referenceFilename) : "",
        targetLanguage,
      });
    },
    [applyOpenedDocument],
  );

  const openLangFile = useCallback(
    async (file: File) => {
      await runWithImportSpinner(async () => {
        const text = await readFileAsText(file);
        openWorkspaceFromText(text, { filename: file.name });
        toast.success(t("toast.fileLoaded"));
      });
    },
    [openWorkspaceFromText, runWithImportSpinner, t],
  );

  const openWorkspaceFiles = useCallback(
    async (files: Record<string, File>) => {
      await runWithImportSpinner(async () => {
        const loaderId = stateRef.current.selectedGameLoaderId;
        if (!loaderId) {
          throw new Error("openWorkspaceFiles called with no game loader selected");
        }
        const loader = resolveGameLoader(loaderId);
        const picked = await Promise.all(
          loader.requiredFiles.map(async (rf) => {
            const file = files[rf.role];
            if (!file) return null;
            const text = await readFileAsText(file);
            const validation = rf.validate?.({ name: file.name, text });
            return { rf, file, text, validation };
          }),
        );
        for (const entry of picked) {
          if (entry?.validation && !entry.validation.ok) {
            toast.error(t(entry.validation.messageKey));
            return;
          }
        }
        const present = picked.filter(
          (entry): entry is NonNullable<typeof entry> => entry !== null,
        );
        const raw = resolveFileLoader(loader.fileLoaderId).parse({
          files: present.map(({ file, text }) => ({ name: file.name, text })),
        });
        const roles = present.map(({ rf }) => ({ role: rf.role }));
        const auxRole = auxRoleOf(loader);
        const translationFile = files[TRANSLATION_ROLE];
        const translationEntry = present.find(({ rf }) => rf.role === TRANSLATION_ROLE);
        const referenceEntry = present.find(({ rf }) => rf.role === auxRole);
        const targetLanguage = codeFromFilename(translationFile.name);
        const document = loader.toDocument(raw, roles, targetLanguage || "und");
        const translationDisplayName =
          (translationEntry?.validation?.ok && translationEntry.validation.displayName) ||
          cleanDownloadedFilename(translationFile.name, loader.fileExtension);
        const referenceDisplayName =
          (referenceEntry?.validation?.ok && referenceEntry.validation.displayName) ||
          referenceEntry?.file.name ||
          "";
        applyOpenedDocument(document, {
          filename: translationDisplayName,
          referenceFilename: referenceDisplayName,
          targetLanguage,
        });
        toast.success(t("toast.fileLoaded"));
      });
    },
    [applyOpenedDocument, runWithImportSpinner, t],
  );

  const createFromReferenceFile = useCallback(
    async (file: File) => {
      await runWithImportSpinner(async () => {
        const loaderId = stateRef.current.selectedGameLoaderId;
        if (!loaderId) return;
        const loader = resolveGameLoader(loaderId);
        if (!loader.createFromReference) {
          toast.error(t("err.newTranslationNoEntries"));
          return;
        }
        const text = await readFileAsText(file);
        const referenceRf = loader.requiredFiles.find((rf) => rf.role === auxRoleOf(loader));
        const validation = referenceRf?.validate?.({ name: file.name, text });
        if (validation && !validation.ok) {
          toast.error(t(validation.messageKey));
          return;
        }
        const displayName = (validation?.ok && validation.displayName) || file.name;
        const referenceRaw = resolveFileLoader(loader.fileLoaderId).parse({
          files: [{ name: displayName, text }],
        });
        let document: TranslationDocument;
        try {
          document = loader.createFromReference(referenceRaw, "und");
        } catch {
          toast.error(t("err.newTranslationNoEntries"));
          return;
        }
        const entryCount = document.nodes.filter((node) => node.type === "entry").length;
        if (!entryCount) {
          toast.error(t("err.newTranslationNoEntries"));
          return;
        }
        // Apply the same English body as the live reference so SAME_TRANSLATION
        // and the reminder button settle in one frame — no pulse flash.
        applyOpenedDocument(document, {
          filename: "",
          referenceFilename: displayName,
          targetLanguage: "",
        });
        toast.success(
          t("toast.newTranslationCreated", {
            file: displayName,
            n: entryCount,
          }),
        );
      });
    },
    [applyOpenedDocument, runWithImportSpinner, t],
  );

  const loadReferenceFile = useCallback(
    async (file: File) => {
      await runWithImportSpinner(async () => {
        const current = stateRef.current;
        const loaderId = current.selectedGameLoaderId;
        if (!loaderId) return;
        const loader = resolveGameLoader(loaderId);
        if (!loader.attachReference) {
          toast.error(t("err.newTranslationNoEntries"));
          return;
        }
        const text = await readFileAsText(file);
        const referenceRf = loader.requiredFiles.find((rf) => rf.role === auxRoleOf(loader));
        const validation = referenceRf?.validate?.({ name: file.name, text });
        if (validation && !validation.ok) {
          toast.error(t(validation.messageKey));
          return;
        }
        const displayName = (validation?.ok && validation.displayName) || file.name;
        const referenceRaw = resolveFileLoader(loader.fileLoaderId).parse({
          files: [{ name: displayName, text }],
        });

        const nextDocument = loader.attachReference(current.document, referenceRaw);
        const nextEntries = buildWorkspaceEntries(nextDocument, entryUiFlagsRef.current);
        const indexes = buildWorkspaceRowIndex(nextEntries, loader, current.glossaries);
        setRowIndexes(indexes);
        rowIndexesRef.current = indexes;
        setState((prev) => ({
          ...prev,
          document: nextDocument,
          referenceFilename: displayName,
        }));
        // Total matched, same as today's count — not a "newly matched" delta.
        const matched = nextEntries.filter((entry) => entry.referenceText != null).length;
        toast.success(t("btn.enRefLoaded", { file: displayName, n: matched }));
        scheduleSave();
      });
    },
    [runWithImportSpinner, scheduleSave, t],
  );

  const closeWorkspace = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    entryUiFlagsRef.current = new Map();
    rowIndexesRef.current = new Map();
    setRowIndexes(new Map());
    setState((current) => ({
      ...current,
      isOpen: false,
      selectedGameLoaderId: null,
      filename: "",
      referenceFilename: "",
      document: EMPTY_DOCUMENT,
      filter: "missing",
      query: "",
      view: "editor",
      reviewFilter: "all",
      reviewQuery: "",
      targetLanguage: "",
      compactView: false,
      savedAt: 0,
      saveState: "saved",
      diffOther: null,
      terminologyFilterActive: false,
    }));
    void clearWorkspaceDocument();
  }, []);

  const exportLang = useCallback(() => {
    setState((current) => {
      let name = current.filename.trim();
      if (!name) {
        toast.error(t("err.targetFilenameRequired"));
        return current;
      }
      const extension = resolveGameLoader(current.document.gameLoaderId).fileExtension;
      if (!name.toLowerCase().endsWith(extension.toLowerCase())) name += extension;
      downloadText(name, exportedText(current.document));
      toast.success(t("toast.exported", { name }));
      return { ...current, filename: name };
    });
  }, [t]);

  const saveProgressFile = useCallback(async () => {
    const record = recordFromState(state, entryUiFlagsRef.current);
    const document: ProgressDocumentV3 = serializeProgressV3(record);
    const base = (state.filename || "translation.lang").replace(/\.lang$/i, "");
    const text = JSON.stringify(document);
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
      await runWithImportSpinner(async () => {
        try {
          let text: string;
          if (/\.gz$/i.test(file.name) || file.type === "application/gzip") {
            text = await gunzipToText(await readFileAsArrayBuffer(file));
          } else {
            text = await readFileAsText(file);
          }
          const record = deserializeProgressV3(JSON.parse(text));
          applyStoredRecord(record, stateRef.current.glossaries);
          scheduleSave();
          toast.success(t("toast.progressRestored"));
        } catch (error) {
          toast.error(
            t("err.readFile", { msg: error instanceof Error ? error.message : t("err.generic") }),
          );
        }
      });
    },
    [applyStoredRecord, runWithImportSpinner, scheduleSave, t],
  );

  const updateEntryValue = useCallback(
    (entryId: string, value: string, options?: { mtDraft?: boolean }) => {
      const current = stateRef.current;
      const nextDocument = updateEntryTarget(current.document, entryId, value);
      if (nextDocument === current.document) return;
      entryUiFlagsRef.current.set(entryId, {
        touched: true,
        mtDraft: options?.mtDraft ?? false,
      });

      const loader = resolveGameLoader(nextDocument.gameLoaderId);
      const nextEntry = findWorkspaceEntry(nextDocument, entryId, entryUiFlagsRef.current);
      const next = new Map(rowIndexesRef.current);
      const nextIndex = nextEntry
        ? reindexWorkspaceEntry(next, nextEntry, loader, current.glossaries)
        : undefined;
      const prevIndex = rowIndexesRef.current.get(entryId);
      rowIndexesRef.current = next;
      // Only publish a new Map when filter-relevant flags change — otherwise the
      // virtual list rebuilds and measure() snaps the scroll mid-fling.
      if (!sameRowIndex(prevIndex, nextIndex)) setRowIndexes(next);

      setState((prev) => ({ ...prev, document: nextDocument }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const toggleMarkedSame = useCallback(
    (entryId: string) => {
      const current = stateRef.current;
      const nextDocument = toggleEntryMarkedSame(current.document, entryId);
      if (nextDocument === current.document) return;
      const previousFlags = entryUiFlagsRef.current.get(entryId);
      entryUiFlagsRef.current.set(entryId, {
        touched: true,
        mtDraft: previousFlags?.mtDraft ?? false,
      });

      const loader = resolveGameLoader(nextDocument.gameLoaderId);
      const nextEntry = findWorkspaceEntry(nextDocument, entryId, entryUiFlagsRef.current);
      const next = new Map(rowIndexesRef.current);
      if (nextEntry) reindexWorkspaceEntry(next, nextEntry, loader, current.glossaries);
      rowIndexesRef.current = next;
      setRowIndexes(next);

      setState((prev) => ({ ...prev, document: nextDocument }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const translateEntry = useCallback(
    async (entryId: string) => {
      const node = stateRef.current.document.nodes.find(
        (candidate) => candidate.type === "entry" && candidate.entry.id === entryId,
      );
      if (!node || node.type !== "entry") return;
      const target = normalizeProjectCode(state.targetLanguage);
      if (!target) {
        toast.error(t("mt.langTitle"));
        return;
      }
      const source = node.entry.source;
      if (!source.trim()) {
        toast.error(t("mt.emptySrc"));
        return;
      }
      try {
        const loader = resolveGameLoader(stateRef.current.document.gameLoaderId);
        const suggestion = await translateWithProvider(state.mtProvider, {
          text: source,
          targetLanguage: target,
          sourceLanguage: "en",
          tokenizer: loader.placeholders,
        });
        if (suggestion.trim()) updateEntryValue(entryId, suggestion, { mtDraft: true });
      } catch (error) {
        toast.error(
          t("mt.prefix", { msg: error instanceof Error ? error.message : t("err.generic") }),
        );
      }
    },
    [state.mtProvider, state.targetLanguage, t, updateEntryValue],
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

      const loader = resolveGameLoader(stateRef.current.document.gameLoaderId);
      const entries = buildWorkspaceEntries(stateRef.current.document, entryUiFlagsRef.current);
      const next = buildWorkspaceRowIndex(entries, loader, glossaries);
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
    (entry: WorkspaceEntry) =>
      inspectTerminology(entry.source, entry.target, enabledGlossaries, entry.key),
    [enabledGlossaries],
  );

  const terminologyMatchesFor = useCallback(
    (entry: WorkspaceEntry) =>
      matchingTerminologyRules(entry.source, entry.target, enabledGlossaries, entry.key),
    [enabledGlossaries],
  );

  const activeLoader = useMemo(
    () => resolveGameLoader(state.document.gameLoaderId),
    [state.document.gameLoaderId],
  );

  const flowStage: FlowStage = useMemo(() => {
    if (state.isOpen || state.view === "terminology") return "editor";
    if (!state.selectedGameLoaderId) return "select-game";
    return "dropzone";
  }, [state.isOpen, state.view, state.selectedGameLoaderId]);

  const lines = useMemo(
    () => buildWorkspaceLines(state.document, entryUiFlagsRef.current),
    [state.document],
  );

  const entries = useMemo(
    () => buildWorkspaceEntries(state.document, entryUiFlagsRef.current),
    [state.document],
  );

  const filteredEntries = useMemo(() => {
    const query = normalizeSearchQuery(state.query);
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
          `${entry.key}\n${entry.target}\n${entry.originalValue}\n${entry.referenceText || ""}`.toLowerCase();
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
    () => hasUsableReference(entries, state.referenceFilename),
    [entries, state.referenceFilename],
  );
  const whitespaceIssueCount = indexCounts.wsIssues;
  const terminologyIssueCount = indexCounts.glossaryIssues;

  const value: WorkspaceContextValue = {
    ...state,
    isImportingFile,
    flowStage,
    activeLoader,
    selectGameLoader: (id) => setState((current) => ({ ...current, selectedGameLoaderId: id })),
    lines,
    entries,
    openWorkspaceFromText,
    openLangFile,
    openWorkspaceFiles,
    createFromReferenceFile,
    loadReferenceFile,
    closeWorkspace,
    exportLang,
    saveProgressFile,
    loadProgressFile,
    setFilename: (name) => {
      setState((current) => ({ ...current, filename: name }));
      scheduleSave();
    },
    setFilter: (filter) => setState((current) => ({ ...current, filter })),
    setQuery: (query) => setState((current) => ({ ...current, query })),
    setView: (view) => setState((current) => ({ ...current, view })),
    setReviewFilter: (reviewFilter) => setState((current) => ({ ...current, reviewFilter })),
    setReviewQuery: (reviewQuery) => setState((current) => ({ ...current, reviewQuery })),
    setSpellcheck: (spellcheck) => {
      setState((current) => ({ ...current, spellcheck }));
      scheduleSave();
    },
    setAutocompleteEnabled: (autocompleteEnabled) => {
      setState((current) => ({ ...current, autocompleteEnabled }));
      scheduleSave();
    },
    setMtProvider: (mtProvider) => {
      try {
        localStorage.setItem(PREFERRED_PROVIDER_KEY, mtProvider);
      } catch {
        /* ignore */
      }
      setState((current) => ({ ...current, mtProvider }));
      scheduleSave();
    },
    setTargetLanguage: (targetLanguage) => {
      const normalized = normalizeProjectCode(targetLanguage);
      setState((current) => ({
        ...current,
        targetLanguage: normalized,
        document: { ...current.document, targetLocale: normalized || "und" },
      }));
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
    terminologyMatchesFor,
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
