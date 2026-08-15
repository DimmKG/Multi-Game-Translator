// SPDX-License-Identifier: AGPL-3.0-or-later
import { FileLoaderParseError, type FileLoader, type FileLoaderInput } from "../file-loader";
import { buildIniLines, parseIniLines, type IniRaw } from "../helpers/ini";

export interface IniFileEntry {
  name: string;
  ini: IniRaw;
}

/**
 * One parsed ini-family structure per input file, in FileLoaderInput.files
 * order — see the architecture doc's note on multi-file File Loaders.
 */
export type IniFileLoaderRaw = IniFileEntry[];

/**
 * Union of comment styles across every MVP ini-flavored format (Necesse's
 * "//", Factorio's "#"/";"). Permissive on purpose: recognizing an extra
 * comment style a given game doesn't use is harmless, since parseIniLines
 * only uses this for classification — buildIniLines always reproduces a
 * comment line's original raw text verbatim regardless.
 */
const COMMENT_PREFIXES = ["//", "#", ";"];

function extractText(file: FileLoaderInput["files"][number]): string {
  if (typeof file.text === "string") return file.text;
  if (file.bytes) return new TextDecoder().decode(file.bytes);
  throw new FileLoaderParseError("ini", `File "${file.name}" has neither text nor bytes.`);
}

/** detect() only needs a representative sample — capped for files with thousands of lines. */
const DETECT_SAMPLE_LINES = 200;

/** First `maxLines` lines of `text`, without splitting/allocating the rest of a large file. */
function takeLines(text: string, maxLines: number): string {
  let index = 0;
  for (let count = 0; count < maxLines; count++) {
    const next = text.indexOf("\n", index);
    if (next === -1) return text;
    index = next + 1;
  }
  return text.slice(0, index);
}

function detectOne(text: string): number {
  const sample = takeLines(text, DETECT_SAMPLE_LINES);
  const lines = sample.split(/\r\n|\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return 0;
  const recognized = lines.filter((line) => {
    const trimmed = line.trim();
    if (COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return true;
    if (/^\[.*\]$/.test(trimmed)) return true;
    return line.includes("=");
  });
  return recognized.length / lines.length;
}

/**
 * Generic ini/cfg File Loader — pure structure (blank/comment/section/pair),
 * no game semantics. Shared by Necesse, generic-ini, and Factorio Game Loaders.
 */
export const iniFileLoader: FileLoader<IniFileLoaderRaw> = {
  id: "ini",
  displayName: "Ini / cfg (key=value)",
  extensions: [".ini", ".cfg", ".lang", ".txt"],

  detect(input) {
    if (!input.files.length) return 0;
    const scores = input.files.map((file) => detectOne(extractText(file)));
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  },

  parse(input) {
    return input.files.map((file) => ({
      name: file.name,
      ini: parseIniLines(extractText(file), { commentPrefixes: COMMENT_PREFIXES }),
    }));
  },

  serialize(raw) {
    return {
      files: raw.map((entry) => ({ name: entry.name, text: buildIniLines(entry.ini) })),
    };
  },
};
