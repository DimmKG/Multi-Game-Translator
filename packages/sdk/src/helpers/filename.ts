// SPDX-License-Identifier: LGPL-3.0-or-later

/**
 * Strips download-duplication artifacts a browser adds to a re-downloaded
 * file ("(1)", "_1_") without breaking locale codes like pt-BR, and
 * (re-)applies the loader's canonical extension. Generalizes what used to be
 * a Necesse-only cleanNecesseFilename — the dedup-suffix logic isn't
 * game-specific, only the extension is, so that's the one parameter.
 */
export function cleanDownloadedFilename(name: string, extension: string): string {
  const extensionPattern = new RegExp(`${extension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  let base = String(name || "").replace(extensionPattern, "");
  base = base.replace(/\s*\(\d+\)\s*$/, "");
  base = base.replace(/_\d+_?/g, "");
  base = base.replace(/^_+|_+$/g, "");
  return base ? `${base}${extension}` : `translation${extension}`;
}
