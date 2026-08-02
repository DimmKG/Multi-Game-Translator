import {
  MISSING_TRANSLATION_PREFIX,
  SAME_TRANSLATION_PREFIX,
  PROTECTED_TOKEN_PATTERN,
} from "@/core/lang/markers";

const DEFAULT_MATRIX_LIMIT = 60000;

export type DiffSegmentKind = "equal" | "add" | "delete";

export interface DiffSegment {
  kind: DiffSegmentKind;
  text: string;
}

export interface TokenUnit {
  value: string;
  protected: boolean;
}

export function splitStatusPrefix(line: string): {
  status: "missing" | "same" | "none";
  prefix: string;
  body: string;
} {
  const text = String(line ?? "");
  if (text.startsWith(MISSING_TRANSLATION_PREFIX)) {
    return {
      status: "missing",
      prefix: MISSING_TRANSLATION_PREFIX,
      body: text.slice(MISSING_TRANSLATION_PREFIX.length),
    };
  }
  if (text.startsWith(SAME_TRANSLATION_PREFIX)) {
    return {
      status: "same",
      prefix: SAME_TRANSLATION_PREFIX,
      body: text.slice(SAME_TRANSLATION_PREFIX.length),
    };
  }
  return { status: "none", prefix: "", body: text };
}

export function parseLangLine(line: string) {
  const raw = String(line ?? "");
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//") || /^\[.*\]$/.test(trimmed)) {
    return { type: "text" as const, raw };
  }

  const status = splitStatusPrefix(raw);
  const separator = status.body.indexOf("=");
  if (separator < 0) return { type: "text" as const, raw };

  return {
    type: "entry" as const,
    raw,
    status: status.status,
    prefix: status.prefix,
    body: status.body,
    key: status.body.slice(0, separator),
    value: status.body.slice(separator + 1),
  };
}

export function alignmentIdentity(line: string): string {
  return splitStatusPrefix(line).body;
}

function lcsPairs(left: string[], right: string[], matrixLimit = DEFAULT_MATRIX_LIMIT) {
  const leftLength = left.length;
  const rightLength = right.length;
  if (!leftLength || !rightLength || leftLength * rightLength > matrixLimit) return null;

  const width = rightLength + 1;
  const matrix = new Uint32Array((leftLength + 1) * width);
  for (let rowIndex = leftLength - 1; rowIndex >= 0; rowIndex--) {
    const row = rowIndex * width;
    const nextRow = (rowIndex + 1) * width;
    for (let columnIndex = rightLength - 1; columnIndex >= 0; columnIndex--) {
      matrix[row + columnIndex] =
        left[rowIndex] === right[columnIndex]
          ? matrix[nextRow + columnIndex + 1] + 1
          : Math.max(matrix[nextRow + columnIndex], matrix[row + columnIndex + 1]);
    }
  }

  const pairs: Array<[number, number]> = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftLength && rightIndex < rightLength) {
    if (left[leftIndex] === right[rightIndex]) {
      pairs.push([leftIndex, rightIndex]);
      leftIndex += 1;
      rightIndex += 1;
    } else if (
      matrix[(leftIndex + 1) * width + rightIndex] >= matrix[leftIndex * width + rightIndex + 1]
    ) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }
  return pairs;
}

function pushPlainUnits(units: TokenUnit[], text: string, mode: "word" | "character") {
  if (!text) return;
  if (mode === "character") {
    for (const value of Array.from(text)) units.push({ value, protected: false });
    return;
  }
  const parts = text.match(/\s+|[^\s]+/g) || [];
  for (const value of parts) units.push({ value, protected: false });
}

export function tokenizeProtected(text: string, mode: "word" | "character" = "word"): TokenUnit[] {
  const source = String(text ?? "");
  const units: TokenUnit[] = [];
  let index = 0;
  PROTECTED_TOKEN_PATTERN.lastIndex = 0;

  for (
    let match = PROTECTED_TOKEN_PATTERN.exec(source);
    match;
    match = PROTECTED_TOKEN_PATTERN.exec(source)
  ) {
    if (match.index > index) pushPlainUnits(units, source.slice(index, match.index), mode);
    units.push({ value: match[0], protected: true });
    index = match.index + match[0].length;
  }
  if (index < source.length) pushPlainUnits(units, source.slice(index), mode);
  return units;
}

function appendSegment(target: DiffSegment[], kind: DiffSegmentKind, units: TokenUnit[]) {
  if (!units.length) return;
  const text = units.map((unit) => unit.value).join("");
  const previous = target[target.length - 1];
  if (previous && previous.kind === kind) previous.text += text;
  else target.push({ kind, text });
}

export function inlineSegments(
  leftText: string,
  rightText: string,
  mode: "word" | "character" = "word",
  matrixLimit = DEFAULT_MATRIX_LIMIT,
) {
  const left = tokenizeProtected(leftText, mode);
  const right = tokenizeProtected(rightText, mode);
  const pairs = lcsPairs(
    left.map((unit) => unit.value),
    right.map((unit) => unit.value),
    matrixLimit,
  );

  if (pairs === null) {
    return {
      fallback: true,
      left: [{ kind: "delete" as const, text: String(leftText ?? "") }],
      right: [{ kind: "add" as const, text: String(rightText ?? "") }],
    };
  }

  const leftSegments: DiffSegment[] = [];
  const rightSegments: DiffSegment[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  for (const [leftMatch, rightMatch] of pairs) {
    appendSegment(leftSegments, "delete", left.slice(leftIndex, leftMatch));
    appendSegment(rightSegments, "add", right.slice(rightIndex, rightMatch));
    appendSegment(leftSegments, "equal", [left[leftMatch]]);
    appendSegment(rightSegments, "equal", [right[rightMatch]]);
    leftIndex = leftMatch + 1;
    rightIndex = rightMatch + 1;
  }

  appendSegment(leftSegments, "delete", left.slice(leftIndex));
  appendSegment(rightSegments, "add", right.slice(rightIndex));
  return { fallback: false, left: leftSegments, right: rightSegments };
}

export function compareEntryPair(
  leftLine: string,
  rightLine: string,
  mode: "word" | "character" = "word",
  matrixLimit = DEFAULT_MATRIX_LIMIT,
) {
  const left = parseLangLine(leftLine);
  const right = parseLangLine(rightLine);
  if (left.type !== "entry" || right.type !== "entry") {
    return {
      type: "text" as const,
      left,
      right,
      inline: inlineSegments(leftLine, rightLine, mode, matrixLimit),
    };
  }

  return {
    type: "entry" as const,
    left,
    right,
    statusChanged: left.status !== right.status,
    keyChanged: left.key !== right.key,
    valueChanged: left.value !== right.value,
    keyInline: inlineSegments(left.key, right.key, mode, matrixLimit),
    valueInline: inlineSegments(left.value, right.value, mode, matrixLimit),
  };
}

export interface DiffRow {
  kind: "equal" | "change" | "add" | "delete";
  leftIndex: number;
  rightIndex: number;
  prefixOnly?: boolean;
}

export function diffRows(
  leftLines: string[],
  rightLines: string[],
  matrixLimit = 1_500_000,
): DiffRow[] {
  const leftIdentity = leftLines.map(alignmentIdentity);
  const rightIdentity = rightLines.map(alignmentIdentity);
  const pairs = lcsPairs(leftIdentity, rightIdentity, matrixLimit) || [];
  const rows: DiffRow[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  function flushGap(leftEnd: number, rightEnd: number) {
    const deleted = leftEnd - leftIndex;
    const added = rightEnd - rightIndex;
    const count = Math.max(deleted, added);
    for (let offset = 0; offset < count; offset++) {
      const hasLeft = offset < deleted;
      const hasRight = offset < added;
      rows.push({
        kind: hasLeft && hasRight ? "change" : hasLeft ? "delete" : "add",
        leftIndex: hasLeft ? leftIndex + offset : -1,
        rightIndex: hasRight ? rightIndex + offset : -1,
      });
    }
    leftIndex = leftEnd;
    rightIndex = rightEnd;
  }

  for (const [leftMatch, rightMatch] of pairs) {
    if (leftMatch > leftIndex || rightMatch > rightIndex) flushGap(leftMatch, rightMatch);
    const prefixChanged = String(leftLines[leftMatch]) !== String(rightLines[rightMatch]);
    rows.push({
      kind: prefixChanged ? "change" : "equal",
      leftIndex: leftMatch,
      rightIndex: rightMatch,
      prefixOnly:
        prefixChanged &&
        alignmentIdentity(leftLines[leftMatch]) === alignmentIdentity(rightLines[rightMatch]),
    });
    leftIndex = leftMatch + 1;
    rightIndex = rightMatch + 1;
  }
  if (leftIndex < leftLines.length || rightIndex < rightLines.length) {
    flushGap(leftLines.length, rightLines.length);
  }
  return rows;
}

export function summarizeRows(rows: DiffRow[], leftLines: string[], rightLines: string[]) {
  const summary = {
    added: 0,
    deleted: 0,
    changed: 0,
    prefixOnly: 0,
    changedKeys: 0,
    changedValues: 0,
  };
  for (const row of rows) {
    if (row.kind === "add") summary.added += 1;
    else if (row.kind === "delete") summary.deleted += 1;
    else if (row.kind === "change") {
      summary.changed += 1;
      if (row.prefixOnly) summary.prefixOnly += 1;
      if (row.leftIndex >= 0 && row.rightIndex >= 0) {
        const detail = compareEntryPair(leftLines[row.leftIndex], rightLines[row.rightIndex]);
        if (detail.type === "entry") {
          if (detail.keyChanged) summary.changedKeys += 1;
          if (detail.valueChanged) summary.changedValues += 1;
        }
      }
    }
  }
  return summary;
}
