"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NecesseTokenAwareDiff = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MISSING = "MISSING_TRANSLATION:";
  const SAME = "SAME_TRANSLATION:";
  const PROTECTED_TOKEN_RE = /<[^>]+>|\[[^\]]+\]|§(?:#[0-9a-fA-F]{6}|[0-9A-Za-z])|\\n/g;
  const DEFAULT_MATRIX_LIMIT = 60000;

  function splitStatusPrefix(line) {
    const text = String(line ?? "");
    if (text.startsWith(MISSING)) {
      return { status: "missing", prefix: MISSING, body: text.slice(MISSING.length) };
    }
    if (text.startsWith(SAME)) {
      return { status: "same", prefix: SAME, body: text.slice(SAME.length) };
    }
    return { status: "none", prefix: "", body: text };
  }

  function parseLangLine(line) {
    const raw = String(line ?? "");
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("//") || /^\[.*\]$/.test(trimmed)) {
      return { type: "text", raw };
    }

    const status = splitStatusPrefix(raw);
    const separator = status.body.indexOf("=");
    if (separator < 0) return { type: "text", raw };

    return {
      type: "entry",
      raw,
      status: status.status,
      prefix: status.prefix,
      body: status.body,
      key: status.body.slice(0, separator),
      value: status.body.slice(separator + 1)
    };
  }

  function alignmentIdentity(line) {
    return splitStatusPrefix(line).body;
  }

  function lcsPairs(left, right, matrixLimit = DEFAULT_MATRIX_LIMIT) {
    const n = left.length;
    const m = right.length;
    if (!n || !m || n * m > matrixLimit) return null;

    const width = m + 1;
    const matrix = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      const row = i * width;
      const next = (i + 1) * width;
      for (let j = m - 1; j >= 0; j--) {
        matrix[row + j] = left[i] === right[j]
          ? matrix[next + j + 1] + 1
          : Math.max(matrix[next + j], matrix[row + j + 1]);
      }
    }

    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (left[i] === right[j]) {
        pairs.push([i, j]);
        i++;
        j++;
      } else if (matrix[(i + 1) * width + j] >= matrix[i * width + j + 1]) {
        i++;
      } else {
        j++;
      }
    }
    return pairs;
  }

  function tokenizeProtected(text, mode = "word") {
    const source = String(text ?? "");
    const units = [];
    let index = 0;
    PROTECTED_TOKEN_RE.lastIndex = 0;

    for (let match = PROTECTED_TOKEN_RE.exec(source); match; match = PROTECTED_TOKEN_RE.exec(source)) {
      if (match.index > index) pushPlainUnits(units, source.slice(index, match.index), mode);
      units.push({ value: match[0], protected: true });
      index = match.index + match[0].length;
    }
    if (index < source.length) pushPlainUnits(units, source.slice(index), mode);
    return units;
  }

  function pushPlainUnits(units, text, mode) {
    if (!text) return;
    if (mode === "character") {
      for (const value of Array.from(text)) units.push({ value, protected: false });
      return;
    }
    const parts = text.match(/\s+|[^\s]+/g) || [];
    for (const value of parts) units.push({ value, protected: false });
  }

  function inlineSegments(leftText, rightText, mode = "word", matrixLimit = DEFAULT_MATRIX_LIMIT) {
    const left = tokenizeProtected(leftText, mode);
    const right = tokenizeProtected(rightText, mode);
    const pairs = lcsPairs(
      left.map(unit => unit.value),
      right.map(unit => unit.value),
      matrixLimit
    );

    if (pairs === null) {
      return {
        fallback: true,
        left: [{ kind: "delete", text: String(leftText ?? "") }],
        right: [{ kind: "add", text: String(rightText ?? "") }]
      };
    }

    const leftSegments = [];
    const rightSegments = [];
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

  function appendSegment(target, kind, units) {
    if (!units.length) return;
    const text = units.map(unit => unit.value).join("");
    const previous = target[target.length - 1];
    if (previous && previous.kind === kind) previous.text += text;
    else target.push({ kind, text });
  }

  function compareEntryPair(leftLine, rightLine, mode = "word", matrixLimit = DEFAULT_MATRIX_LIMIT) {
    const left = parseLangLine(leftLine);
    const right = parseLangLine(rightLine);
    if (left.type !== "entry" || right.type !== "entry") {
      return {
        type: "text",
        left,
        right,
        inline: inlineSegments(leftLine, rightLine, mode, matrixLimit)
      };
    }

    return {
      type: "entry",
      left,
      right,
      statusChanged: left.status !== right.status,
      keyChanged: left.key !== right.key,
      valueChanged: left.value !== right.value,
      keyInline: inlineSegments(left.key, right.key, mode, matrixLimit),
      valueInline: inlineSegments(left.value, right.value, mode, matrixLimit)
    };
  }

  function diffRows(leftLines, rightLines, matrixLimit = 1500000) {
    const leftIdentity = leftLines.map(alignmentIdentity);
    const rightIdentity = rightLines.map(alignmentIdentity);
    const pairs = lcsPairs(leftIdentity, rightIdentity, matrixLimit) || [];
    const rows = [];
    let leftIndex = 0;
    let rightIndex = 0;

    function flushGap(leftEnd, rightEnd) {
      const deleted = leftEnd - leftIndex;
      const added = rightEnd - rightIndex;
      const count = Math.max(deleted, added);
      for (let offset = 0; offset < count; offset++) {
        const hasLeft = offset < deleted;
        const hasRight = offset < added;
        rows.push({
          kind: hasLeft && hasRight ? "change" : hasLeft ? "delete" : "add",
          leftIndex: hasLeft ? leftIndex + offset : -1,
          rightIndex: hasRight ? rightIndex + offset : -1
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
        prefixOnly: prefixChanged && alignmentIdentity(leftLines[leftMatch]) === alignmentIdentity(rightLines[rightMatch])
      });
      leftIndex = leftMatch + 1;
      rightIndex = rightMatch + 1;
    }
    if (leftIndex < leftLines.length || rightIndex < rightLines.length) {
      flushGap(leftLines.length, rightLines.length);
    }
    return rows;
  }

  function summarizeRows(rows, leftLines, rightLines) {
    const summary = { added: 0, deleted: 0, changed: 0, prefixOnly: 0, changedKeys: 0, changedValues: 0 };
    for (const row of rows) {
      if (row.kind === "add") summary.added++;
      else if (row.kind === "delete") summary.deleted++;
      else if (row.kind === "change") {
        summary.changed++;
        if (row.prefixOnly) summary.prefixOnly++;
        if (row.leftIndex >= 0 && row.rightIndex >= 0) {
          const detail = compareEntryPair(leftLines[row.leftIndex], rightLines[row.rightIndex]);
          if (detail.type === "entry") {
            if (detail.keyChanged) summary.changedKeys++;
            if (detail.valueChanged) summary.changedValues++;
          }
        }
      }
    }
    return summary;
  }

  return {
    MISSING,
    SAME,
    splitStatusPrefix,
    parseLangLine,
    alignmentIdentity,
    tokenizeProtected,
    inlineSegments,
    compareEntryPair,
    diffRows,
    summarizeRows
  };
});
