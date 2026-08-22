// SPDX-License-Identifier: LGPL-3.0-or-later
import { FileLoaderParseError, type FileLoader, type FileLoaderInput } from "../file-loader";
import { buildPoText, parsePoText, type PoFileRaw } from "../helpers/po";

export interface PoFileEntry {
  name: string;
  po: PoFileRaw;
}

/** One parsed PO structure per input file, same convention as IniFileLoaderRaw. */
export type PoFileLoaderRaw = PoFileEntry[];

function extractText(file: FileLoaderInput["files"][number]): string {
  if (typeof file.text === "string") return file.text;
  if (file.bytes) return new TextDecoder().decode(file.bytes);
  throw new FileLoaderParseError("po", `File "${file.name}" has neither text nor bytes.`);
}

const DETECT_SAMPLE_LINES = 200;

function takeLines(text: string, maxLines: number): string {
  let index = 0;
  for (let count = 0; count < maxLines; count++) {
    const next = text.indexOf("\n", index);
    if (next === -1) return text;
    index = next + 1;
  }
  return text.slice(0, index);
}

const KEYWORD_LINE = /^(msgctxt|msgid_plural|msgid|msgstr)(\[\d+])?[ \t]*"/;
const COMMENT_LINE = /^#[.:,|~]?/;
const BARE_STRING_LINE = /^[ \t]*"/;

function detectOne(text: string): number {
  const sample = takeLines(text, DETECT_SAMPLE_LINES);
  const lines = sample.split(/\r\n|\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return 0;
  const recognized = lines.filter(
    (line) => KEYWORD_LINE.test(line) || COMMENT_LINE.test(line) || BARE_STRING_LINE.test(line),
  );
  return recognized.length / lines.length;
}

/** gettext PO/POT File Loader — the boundary's first genuinely non-ini-family format. */
export const poFileLoader: FileLoader<PoFileLoaderRaw> = {
  id: "po",
  displayName: "gettext PO (.po/.pot)",
  extensions: [".po", ".pot"],

  detect(input) {
    if (!input.files.length) return 0;
    const scores = input.files.map((file) => detectOne(extractText(file)));
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  },

  parse(input) {
    return input.files.map((file) => ({ name: file.name, po: parsePoText(extractText(file)) }));
  },

  serialize(raw) {
    return { files: raw.map((entry) => ({ name: entry.name, text: buildPoText(entry.po) })) };
  },
};
