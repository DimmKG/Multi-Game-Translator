// SPDX-License-Identifier: AGPL-3.0-or-later

export interface PhraseFamilyRecord {
  key: string;
  occurrence?: number;
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

export interface PhraseFamilyTermPair {
  source: string;
  target: string;
  evidenceKeys: readonly string[];
}

export interface AlignedPhraseFamily {
  base: PhraseFamilyTermPair;
  modifiers: readonly PhraseFamilyTermPair[];
}

interface DiscoverPhraseFamilyOptions {
  allowUnanchoredSingleWord?: boolean;
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

function recordIdentity(record: PhraseFamilyRecord): string {
  return `${record.key}\u0000${record.occurrence ?? 0}`;
}

function familyIdentities(family: PhraseFamily): string[] {
  return family.members.map(recordIdentity);
}

function tokenize(value: string): Token[] {
  return [...value.matchAll(WORD_PATTERN)].map((match) => ({
    value: match[0],
    normalized: match[0].toLocaleLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function longestCommonContiguousPhrase(
  left: readonly Token[],
  right: readonly Token[],
): PhraseSeed | null {
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

function modifierValue(member: PhraseFamilyMember): string {
  return [member.prefix, member.suffix].filter(Boolean).join(" ");
}

function commonPrefixLength(values: readonly (readonly Token[])[]): number {
  if (values.length === 0) return 0;
  const shortest = Math.min(...values.map((value) => value.length));
  let length = 0;
  while (
    length < shortest &&
    values.every((value) => value[length].normalized === values[0][length].normalized)
  ) {
    length += 1;
  }
  return length;
}

function commonSuffixLength(values: readonly (readonly Token[])[], prefixLength: number): number {
  if (values.length === 0) return 0;
  const shortestRemainder = Math.min(...values.map((value) => value.length - prefixLength));
  let length = 0;
  while (
    length < shortestRemainder &&
    values.every(
      (value) =>
        value[value.length - 1 - length].normalized ===
        values[0][values[0].length - 1 - length].normalized,
    )
  ) {
    length += 1;
  }
  return length;
}

function distinctModifierParts(family: PhraseFamily): Map<string, string> {
  const modified = family.members
    .map((member) => ({ member, tokens: tokenize(modifierValue(member)) }))
    .filter((item) => item.tokens.length > 0);
  if (modified.length < 2) {
    return new Map(modified.map(({ member }) => [recordIdentity(member), modifierValue(member)]));
  }

  const tokenLists = modified.map((item) => item.tokens);
  const prefixLength = commonPrefixLength(tokenLists);
  const suffixLength = commonSuffixLength(tokenLists, prefixLength);

  return new Map(
    modified.map(({ member, tokens }) => {
      const end = tokens.length - suffixLength;
      const distinct = tokens.slice(prefixLength, end);
      const value =
        distinct.length > 0
          ? distinct.map((token) => token.value).join(" ")
          : modifierValue(member);
      return [recordIdentity(member), value];
    }),
  );
}

function sameIdentities(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((identity) => rightSet.has(identity));
}

export function discoverPhraseFamilies(
  records: readonly PhraseFamilyRecord[],
  options: DiscoverPhraseFamilyOptions = {},
): PhraseFamily[] {
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
      if (
        !existing ||
        seed.displayTokens.join(" ").localeCompare(existing.displayTokens.join(" ")) < 0
      ) {
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
      if (seed.normalizedTokens.length >= 2 || options.allowUnanchoredSingleWord) return true;
      return supporting.some((item) => isExactValue(item.tokens, seed.normalizedTokens));
    });

  const maximal = candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) =>
          other !== candidate &&
          other.supporting.length === candidate.supporting.length &&
          other.seed.normalizedTokens.length > candidate.seed.normalizedTokens.length &&
          containsSequence(other.seed.normalizedTokens, candidate.seed.normalizedTokens) &&
          other.supporting.every((item) =>
            candidate.supporting.some(
              (candidateItem) =>
                recordIdentity(candidateItem.record) === recordIdentity(item.record),
            ),
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

export function alignPhraseFamily(
  sourceFamily: PhraseFamily,
  targetRecords: readonly PhraseFamilyRecord[],
): AlignedPhraseFamily | null {
  const sourceIdentities = familyIdentities(sourceFamily);
  const alignedTargets = targetRecords.filter((record) =>
    sourceIdentities.includes(recordIdentity(record)),
  );
  const targetFamily = discoverPhraseFamilies(alignedTargets, {
    allowUnanchoredSingleWord: true,
  }).find((family) => sameIdentities(familyIdentities(family), sourceIdentities));
  if (!targetFamily) return null;

  const base: PhraseFamilyTermPair = {
    source: sourceFamily.base,
    target: targetFamily.base,
    evidenceKeys: sourceFamily.supportKeys,
  };

  const sourceHasExactBase = sourceFamily.members.some((member) => modifierValue(member) === "");
  const targetHasExactBase = targetFamily.members.some((member) => modifierValue(member) === "");
  if (!sourceHasExactBase || !targetHasExactBase) return { base, modifiers: [] };

  const sourceModifiers = distinctModifierParts(sourceFamily);
  const targetModifiers = distinctModifierParts(targetFamily);
  const modifiers = sourceFamily.members.flatMap((member) => {
    const identity = recordIdentity(member);
    const source = sourceModifiers.get(identity)?.trim() ?? "";
    const target = targetModifiers.get(identity)?.trim() ?? "";
    if (!source || !target) return [];
    return [{ source, target, evidenceKeys: [member.key] }];
  });

  return { base, modifiers };
}
