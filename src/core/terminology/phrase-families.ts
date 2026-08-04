// SPDX-License-Identifier: AGPL-3.0-or-later

export interface PhraseFamilyRecord {
  key: string;
  value: string;
}

export interface PhraseFamilyMember extends PhraseFamilyRecord {
  prefix: string;
  suffix: string;
}

export interface PhraseFamily {
  base: string;
  supportKeys: readonly string[];
  members: readonly PhraseFamilyMember[];
}

interface Token {
  value: string;
  normalized: string;
  start: number;
  end: number;
}

interface PhraseSeed {
  normalizedTokens: readonly string[];
  displayTokens: readonly string[];
}

const WORD_PATTERN = /\p{L}[\p{L}\p{M}'’-]*/gu;

function tokenize(value: string): Token[] {
  return [...value.matchAll(WORD_PATTERN)].map((match) => ({
    value: match[0],
    normalized: match[0].toLocaleLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function longestCommonContiguousPhrase(left: readonly Token[], right: readonly Token[]): PhraseSeed | null {
  let bestLength = 0;
  let bestLeftEnd = 0;
  const previous = new Array(right.length + 1).fill(0) as number[];

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = new Array(right.length + 1).fill(0) as number[];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      if (left[leftIndex - 1].normalized !== right[rightIndex - 1].normalized) continue;
      current[rightIndex] = previous[rightIndex - 1] + 1;
      if (current[rightIndex] > bestLength) {
        bestLength = current[rightIndex];
        bestLeftEnd = leftIndex;
      }
    }
    previous.splice(0, previous.length, ...current);
  }

  if (bestLength === 0) return null;
  const selected = left.slice(bestLeftEnd - bestLength, bestLeftEnd);
  return {
    normalizedTokens: selected.map((token) => token.normalized),
    displayTokens: selected.map((token) => token.value),
  };
}

function findTokenSequence(tokens: readonly Token[], sequence: readonly string[]): number {
  if (sequence.length === 0 || sequence.length > tokens.length) return -1;
  for (let start = 0; start <= tokens.length - sequence.length; start += 1) {
    if (sequence.every((token, offset) => tokens[start + offset].normalized === token)) {
      return start;
    }
  }
  return -1;
}

function isExactValue(tokens: readonly Token[], sequence: readonly string[]): boolean {
  return tokens.length === sequence.length && findTokenSequence(tokens, sequence) === 0;
}

function containsSequence(container: readonly string[], candidate: readonly string[]): boolean {
  if (candidate.length > container.length) return false;
  for (let start = 0; start <= container.length - candidate.length; start += 1) {
    if (candidate.every((token, offset) => container[start + offset] === token)) return true;
  }
  return false;
}

export function discoverPhraseFamilies(records: readonly PhraseFamilyRecord[]): PhraseFamily[] {
  const prepared = records
    .map((record) => ({ record, tokens: tokenize(record.value) }))
    .filter((item) => item.tokens.length > 0);
  const seeds = new Map<string, PhraseSeed>();

  for (let left = 0; left < prepared.length; left += 1) {
    for (let right = left + 1; right < prepared.length; right += 1) {
      const seed = longestCommonContiguousPhrase(prepared[left].tokens, prepared[right].tokens);
      if (!seed) continue;
      const id = seed.normalizedTokens.join("\u0000");
      const existing = seeds.get(id);
      if (!existing || seed.displayTokens.join(" ").localeCompare(existing.displayTokens.join(" ")) < 0) {
        seeds.set(id, seed);
      }
    }
  }

  const candidates = [...seeds.values()]
    .map((seed) => {
      const supporting = prepared.filter(
        (item) => findTokenSequence(item.tokens, seed.normalizedTokens) >= 0,
      );
      return { seed, supporting };
    })
    .filter(({ seed, supporting }) => {
      if (supporting.length < 2) return false;
      if (seed.normalizedTokens.length >= 2) return true;
      return supporting.some((item) => isExactValue(item.tokens, seed.normalizedTokens));
    });

  const maximal = candidates.filter((candidate) =>
    !candidates.some(
      (other) =>
        other !== candidate &&
        other.supporting.length === candidate.supporting.length &&
        other.seed.normalizedTokens.length > candidate.seed.normalizedTokens.length &&
        containsSequence(other.seed.normalizedTokens, candidate.seed.normalizedTokens) &&
        other.supporting.every((item) =>
          candidate.supporting.some((candidateItem) => candidateItem.record.key === item.record.key),
        ),
    ),
  );

  return maximal
    .map(({ seed, supporting }) => {
      const members = supporting.map(({ record, tokens }) => {
        const tokenIndex = findTokenSequence(tokens, seed.normalizedTokens);
        const first = tokens[tokenIndex];
        const last = tokens[tokenIndex + seed.normalizedTokens.length - 1];
        return {
          ...record,
          prefix: record.value.slice(0, first.start).trim(),
          suffix: record.value.slice(last.end).trim(),
        };
      });
      return {
        base: seed.displayTokens.join(" "),
        supportKeys: members.map((member) => member.key),
        members,
      };
    })
    .sort((left, right) => {
      if (right.supportKeys.length !== left.supportKeys.length) {
        return right.supportKeys.length - left.supportKeys.length;
      }
      return right.base.length - left.base.length || left.base.localeCompare(right.base);
    });
}
