// SPDX-License-Identifier: LGPL-3.0-or-later

export type PoCommentKind = "translator" | "extracted" | "reference" | "flag" | "previous";

/** text is everything after the comment-prefix substring, untouched — round-trips verbatim. */
export interface PoCommentLine {
  kind: PoCommentKind;
  text: string;
}

export interface PoMessage {
  comments: PoCommentLine[];
  /** True for a "#~"-prefixed block — preserved, never surfaced as an editable entry. */
  obsolete: boolean;
  msgctxt?: string;
  msgid: string;
  msgidPlural?: string;
  /** Index 0 for a non-plural message; msgstr[N] for a plural one, contiguous 0..nplurals-1. */
  msgstr: string[];
}

export interface PoHeader {
  /** Key: value pairs from the header's msgstr blob, insertion order preserved. */
  fields: Record<string, string>;
  comments: PoCommentLine[];
}

export interface PoFileRaw {
  eol: "\n" | "\r\n";
  trailingNewline: boolean;
  header: PoHeader;
  /** Excludes the header message itself. */
  messages: PoMessage[];
}

/** All of a flag-kind comment's flags across however many "#," lines a message carries. */
export function poMessageFlags(message: Pick<PoMessage, "comments">): string[] {
  return message.comments
    .filter((comment) => comment.kind === "flag")
    .flatMap((comment) =>
      comment.text
        .split(",")
        .map((flag) => flag.trim())
        .filter(Boolean),
    );
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" };

function unescapePoString(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\" && i + 1 < raw.length) {
      const mapped = ESCAPES[raw[i + 1]];
      out += mapped !== undefined ? mapped : `\\${raw[i + 1]}`;
      i += 2;
      continue;
    }
    out += raw[i];
    i += 1;
  }
  return out;
}

function escapePoString(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out;
}

/**
 * Reads one quoted string starting at `start` (which must point at the
 * opening "). Never throws on an unterminated string — degrades to
 * "everything to end of line", since a truncated/malformed .po shouldn't
 * crash the whole document load.
 */
function readQuotedString(line: string, start: number): string {
  if (line[start] !== '"') return "";
  let i = start + 1;
  let raw = "";
  while (i < line.length) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length) {
      raw += ch + line[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') break;
    raw += ch;
    i += 1;
  }
  return unescapePoString(raw);
}

type FieldKeyword = "msgctxt" | "msgid" | "msgidPlural" | "msgstr";

/** Longest-alternative-first: "msgid_plural" must be tried before "msgid". */
const KEYWORD_PATTERN = /^(msgctxt|msgid_plural|msgid|msgstr)(\[(\d+)])?[ \t]*/;

function matchFieldKeyword(
  line: string,
): { field: FieldKeyword; index?: number; quoteStart: number } | undefined {
  const match = KEYWORD_PATTERN.exec(line);
  if (!match) return undefined;
  const quoteStart = match[0].length;
  if (line[quoteStart] !== '"') return undefined;
  const keyword = match[1];
  const field: FieldKeyword =
    keyword === "msgctxt"
      ? "msgctxt"
      : keyword === "msgid_plural"
        ? "msgidPlural"
        : keyword === "msgid"
          ? "msgid"
          : "msgstr";
  return { field, index: field === "msgstr" ? Number(match[3] ?? 0) : undefined, quoteStart };
}

function bareStringStart(line: string): number | undefined {
  const leading = /^[ \t]*/.exec(line)?.[0].length ?? 0;
  return line[leading] === '"' ? leading : undefined;
}

const COMMENT_KIND_BY_PREFIX: { prefix: string; kind: PoCommentKind }[] = [
  { prefix: "#.", kind: "extracted" },
  { prefix: "#:", kind: "reference" },
  { prefix: "#,", kind: "flag" },
  { prefix: "#|", kind: "previous" },
];

interface ParsedParagraph {
  comments: PoCommentLine[];
  msgctxt?: string;
  msgid: string;
  msgidPlural?: string;
  msgstr: string[];
}

/**
 * Parses one blank-line-delimited paragraph's physical lines into its
 * fields. Never throws: an unrecognized line degrades to a translator
 * comment rather than being dropped, and a gap in msgstr[N] indices is
 * filled with "".
 */
function parseParagraphLines(lines: string[]): ParsedParagraph {
  const comments: PoCommentLine[] = [];
  let msgctxt: string | undefined;
  let msgid = "";
  let msgidPlural: string | undefined;
  const msgstrByIndex = new Map<number, string>();
  let active: { field: FieldKeyword; index?: number } | undefined;

  function appendActive(value: string) {
    if (!active) {
      comments.push({ kind: "translator", text: value });
      return;
    }
    if (active.field === "msgctxt") msgctxt = (msgctxt ?? "") + value;
    else if (active.field === "msgid") msgid += value;
    else if (active.field === "msgidPlural") msgidPlural = (msgidPlural ?? "") + value;
    else msgstrByIndex.set(active.index ?? 0, (msgstrByIndex.get(active.index ?? 0) ?? "") + value);
  }

  for (const line of lines) {
    if (line.startsWith("#")) {
      active = undefined;
      const matched = COMMENT_KIND_BY_PREFIX.find(({ prefix }) => line.startsWith(prefix));
      comments.push({
        kind: matched?.kind ?? "translator",
        text: line.slice(matched?.prefix.length ?? 1),
      });
      continue;
    }
    const keyword = matchFieldKeyword(line);
    if (keyword) {
      const value = readQuotedString(line, keyword.quoteStart);
      if (keyword.field === "msgctxt") msgctxt = value;
      else if (keyword.field === "msgid") msgid = value;
      else if (keyword.field === "msgidPlural") msgidPlural = value;
      else msgstrByIndex.set(keyword.index ?? 0, value);
      active = { field: keyword.field, index: keyword.index };
      continue;
    }
    const bareStart = bareStringStart(line);
    if (bareStart !== undefined) {
      appendActive(readQuotedString(line, bareStart));
      continue;
    }
    comments.push({ kind: "translator", text: line.startsWith("#") ? line.slice(1) : ` ${line}` });
    active = undefined;
  }

  const maxIndex = Math.max(-1, ...msgstrByIndex.keys());
  const msgstr: string[] = [];
  for (let i = 0; i <= maxIndex; i++) msgstr.push(msgstrByIndex.get(i) ?? "");

  return { comments, msgctxt, msgid, msgidPlural, msgstr };
}

function parseHeaderFields(blob: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of blob.split("\n")) {
    if (line === "") continue;
    const spaceSep = line.indexOf(": ");
    const colon = spaceSep >= 0 ? spaceSep : line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + (spaceSep >= 0 ? 2 : 1));
    if (key) fields[key] = value;
  }
  return fields;
}

function stripObsoletePrefix(line: string): string {
  if (line.startsWith("#~ ")) return line.slice(3);
  if (line.startsWith("#~")) return line.slice(2);
  return line;
}

/**
 * Parses PO/POT text into a structured, round-trippable form. Comments
 * round-trip byte-for-byte; string values round-trip semantically (real
 * gettext tooling is whitespace-tolerant, unlike a strict ini-family
 * format) — multi-line concatenated values collapse to one logical string,
 * not reproduced original line-wrapping.
 */
export function parsePoText(text: string): PoFileRaw {
  const eol: "\n" | "\r\n" = text.includes("\r\n") ? "\r\n" : "\n";
  const trailingNewline = /\r?\n$/.test(text);
  const allLines = text.split(/\r\n|\n/);
  const lines = trailingNewline ? allLines.slice(0, -1) : allLines;

  const paragraphs: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) paragraphs.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) paragraphs.push(current);

  let header: PoHeader = { fields: {}, comments: [] };
  const messages: PoMessage[] = [];
  let headerFound = false;

  for (const paragraphLines of paragraphs) {
    const obsolete = paragraphLines.some((line) => line.startsWith("#~"));
    const effectiveLines = obsolete ? paragraphLines.map(stripObsoletePrefix) : paragraphLines;
    const parsed = parseParagraphLines(effectiveLines);

    if (!headerFound && !obsolete && parsed.msgctxt === undefined && parsed.msgid === "") {
      headerFound = true;
      header = { fields: parseHeaderFields(parsed.msgstr[0] ?? ""), comments: parsed.comments };
      continue;
    }

    messages.push({
      comments: parsed.comments,
      obsolete,
      msgctxt: parsed.msgctxt,
      msgid: parsed.msgid,
      msgidPlural: parsed.msgidPlural,
      msgstr: parsed.msgstr,
    });
  }

  return { eol, trailingNewline, header, messages };
}

function commentPrefix(kind: PoCommentKind): string {
  return COMMENT_KIND_BY_PREFIX.find((entry) => entry.kind === kind)?.prefix ?? "#";
}

function buildParagraphLines(message: {
  comments: PoCommentLine[];
  obsolete: boolean;
  msgctxt?: string;
  msgid: string;
  msgidPlural?: string;
  msgstr: string[];
}): string[] {
  const lines: string[] = [];
  for (const comment of message.comments) lines.push(commentPrefix(comment.kind) + comment.text);
  if (message.msgctxt !== undefined) lines.push(`msgctxt "${escapePoString(message.msgctxt)}"`);
  lines.push(`msgid "${escapePoString(message.msgid)}"`);
  if (message.msgidPlural !== undefined) {
    lines.push(`msgid_plural "${escapePoString(message.msgidPlural)}"`);
  }
  if (message.msgidPlural !== undefined || message.msgstr.length > 1) {
    const plurals = message.msgstr.length ? message.msgstr : [""];
    plurals.forEach((value, index) => lines.push(`msgstr[${index}] "${escapePoString(value)}"`));
  } else {
    lines.push(`msgstr "${escapePoString(message.msgstr[0] ?? "")}"`);
  }
  return message.obsolete ? lines.map((line) => `#~ ${line}`) : lines;
}

/** Inverse of parsePoText(). See its doc comment for the round-trip fidelity contract. */
export function buildPoText(raw: PoFileRaw): string {
  const nl = raw.eol;
  const hasHeader = Object.keys(raw.header.fields).length > 0 || raw.header.comments.length > 0;
  const headerBlob = Object.entries(raw.header.fields)
    .map(([key, value]) => `${key}: ${value}\n`)
    .join("");
  const blocks = [
    ...(hasHeader
      ? [
          buildParagraphLines({
            comments: raw.header.comments,
            obsolete: false,
            msgid: "",
            msgstr: [headerBlob],
          }).join(nl),
        ]
      : []),
    ...raw.messages.map((message) => buildParagraphLines(message).join(nl)),
  ];
  let text = blocks.join(nl + nl);
  if (raw.trailingNewline) text += nl;
  return text;
}
