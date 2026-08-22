// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Structural form of Factorio's __plural_for_parameter_N_{1=X|2=Y|rest=Z}__
 * value-level mini-grammar. Standalone, tested groundwork for a future
 * specialized editor widget — not wired into any UI yet (see
 * PlaceholderToken.subgrammar).
 */
export interface FactorioPluralBucket {
  key: "rest" | number;
  value: string;
}

export interface FactorioPluralExpression {
  parameterIndex: number;
  buckets: FactorioPluralBucket[];
}

const EXPRESSION_PATTERN = /^__plural_for_parameter_(\d+)_\{(.*)\}__$/;

/** Fails soft (undefined) on anything not exactly this shape — never throws. */
export function parseFactorioPluralExpression(raw: string): FactorioPluralExpression | undefined {
  const match = EXPRESSION_PATTERN.exec(raw);
  if (!match) return undefined;
  const parameterIndex = Number(match[1]);
  const bucketTexts = match[2].split("|");
  const buckets: FactorioPluralBucket[] = [];
  for (const bucketText of bucketTexts) {
    const equalsIndex = bucketText.indexOf("=");
    if (equalsIndex < 0) return undefined;
    const rawKey = bucketText.slice(0, equalsIndex);
    const value = bucketText.slice(equalsIndex + 1);
    if (rawKey === "rest") {
      buckets.push({ key: "rest", value });
    } else if (/^\d+$/.test(rawKey)) {
      buckets.push({ key: Number(rawKey), value });
    } else {
      return undefined;
    }
  }
  return { parameterIndex, buckets };
}

export function buildFactorioPluralExpression(expr: FactorioPluralExpression): string {
  const body = expr.buckets.map((bucket) => `${bucket.key}=${bucket.value}`).join("|");
  return `__plural_for_parameter_${expr.parameterIndex}_{${body}}__`;
}
