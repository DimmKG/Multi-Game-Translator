// SPDX-License-Identifier: AGPL-3.0-or-later
import { openNecesseDb, type WorkspaceDocumentRecord } from "./idb";

export type { WorkspaceDocumentRecord, WorkspaceUiFlags } from "./idb";

/** Single-workspace app — one fixed key, not a real workspace id. */
const DOCUMENT_KEY = "workspace";

export async function saveWorkspaceDocument(record: WorkspaceDocumentRecord): Promise<void> {
  const db = await openNecesseDb();
  await db.put("documents", record, DOCUMENT_KEY);
}

export async function loadWorkspaceDocument(): Promise<WorkspaceDocumentRecord | null> {
  const db = await openNecesseDb();
  const record = await db.get("documents", DOCUMENT_KEY);
  return record ?? null;
}

export async function clearWorkspaceDocument(): Promise<void> {
  const db = await openNecesseDb();
  await db.delete("documents", DOCUMENT_KEY);
}
