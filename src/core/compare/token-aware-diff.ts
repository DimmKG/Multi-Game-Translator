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

/** Longest strictly increasing run by right index, so anchors stay ordered. */
function longestIncreasingByRight(pairs: Array<[number, number]>): Array<[number, number]> {
  if (pairs.length < 2) return pairs;
  const tails: number[] = [];
  const tailIndex: number[] = [];
  const previous = new Array<number>(pairs.length).fill(-1);

  for (let i = 0; i < pairs.length; i++) {
    const value = pairs[i][1];
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (tails[mid] < value) low = mid + 1;
      else high = mid;
    }
    tails[low] = value;
    tailIndex[low] = i;
    previous[i] = low > 0 ? tailIndex[low - 1] : -1;
  }

  const result: Array<[number, number]> = [];
  for (let i = tailIndex[tails.length - 1]; i >= 0; i = previous[i]) result.push(pairs[i]);
  return result.reverse();
}

/**
 * Lines occurring exactly once on both sides are near-certain matches, so they
 * make safe split points (the patience-diff idea). They let a huge region be
 * cut into small ones that the quadratic LCS can afford.
 */
function uniqueAnchors(
  left: string[],
  right: string[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): Array<[number, number]> {
  const leftSeen = new Map<string, number>();
  for (let i = leftStart; i < leftEnd; i++) {
    const line = left[i];
    leftSeen.set(line, leftSeen.has(line) ? -1 : i);
  }
  const rightSeen = new Map<string, number>();
  for (let i = rightStart; i < rightEnd; i++) {
    const line = right[i];
    rightSeen.set(line, rightSeen.has(line) ? -1 : i);
  }

  const anchors: Array<[number, number]> = [];
  for (const [line, leftIndex] of leftSeen) {
    if (leftIndex < 0) continue;
    const rightIndex = rightSeen.get(line);
    if (rightIndex === undefined || rightIndex < 0) continue;
    anchors.push([leftIndex, rightIndex]);
  }
  anchors.sort((a, b) => a[0] - b[0]);
  return longestIncreasingByRight(anchors);
}

/**
 * Aligns a region into ascending index pairs.
 *
 * Real .lang files run to thousands of lines, where a full LCS matrix is far
 * out of reach. Shaving the identical head and tail usually removes almost
 * everything; whatever is left is split on unique anchor lines until the pieces
 * are small enough for the exact algorithm.
 */
function alignRegion(
  left: string[],
  right: string[],
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
  matrixLimit: number,
  out: Array<[number, number]>,
) {
  let lo = leftStart;
  let ro = rightStart;
  let hi = leftEnd;
  let rhi = rightEnd;

  while (lo < hi && ro < rhi && left[lo] === right[ro]) out.push([lo++, ro++]);

  const tail: Array<[number, number]> = [];
  while (hi > lo && rhi > ro && left[hi - 1] === right[rhi - 1]) tail.push([--hi, --rhi]);
  tail.reverse();

  if (lo < hi && ro < rhi) {
    const leftSize = hi - lo;
    const rightSize = rhi - ro;
    if (leftSize * rightSize <= matrixLimit) {
      const pairs = lcsPairs(left.slice(lo, hi), right.slice(ro, rhi), matrixLimit);
      if (pairs) for (const [a, b] of pairs) out.push([a + lo, b + ro]);
    } else {
      const anchors = uniqueAnchors(left, right, lo, hi, ro, rhi);
      if (anchors.length) {
        let cursorLeft = lo;
        let cursorRight = ro;
        for (const [anchorLeft, anchorRight] of anchors) {
          alignRegion(
            left,
            right,
            cursorLeft,
            anchorLeft,
            cursorRight,
            anchorRight,
            matrixLimit,
            out,
          );
          out.push([anchorLeft, anchorRight]);
          cursorLeft = anchorLeft + 1;
          cursorRight = anchorRight + 1;
        }
        alignRegion(left, right, cursorLeft, hi, cursorRight, rhi, matrixLimit, out);
      }
      // Without anchors the region shares no landmark; leave it unaligned so the
      // rows show up as a straight replacement.
    }
  }

  for (const pair of tail) out.push(pair);
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
  const pairs: Array<[number, number]> = [];
  alignRegion(
    leftIdentity,
    rightIdentity,
    0,
    leftIdentity.length,
    0,
    rightIdentity.length,
    matrixLimit,
    pairs,
  );
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
