// SPDX-License-Identifier: LGPL-3.0-or-later
import type { PluralCategory } from "../model/document";
import { CANONICAL_PLURAL_ORDER } from "./plural";

export interface PluralFormsSpec {
  nplurals: number;
  evaluate(n: number): number;
}

export interface ParsePluralFormsResult {
  spec: PluralFormsSpec;
  /** Present only when parsing/validating failed and the English default was substituted. */
  fallbackReason?: string;
}

/** nplurals=2; plural=(n != 1); — the fallback whenever a real header can't be parsed safely. */
export const ENGLISH_PLURAL_FORMS: PluralFormsSpec = {
  nplurals: 2,
  evaluate: (n) => (n !== 1 ? 1 : 0),
};

// ---------------------------------------------------------------------------
// Safe expression evaluator for the "plural=EXPR" sub-field of a Plural-Forms
// header. EXPR comes from untrusted user-supplied .po file content, so this
// deliberately never uses eval()/new Function() — a hand-rolled tokenizer +
// recursive-descent parser + pure-data-walk evaluator over a tiny, closed
// grammar (ternary, &&/||, comparisons, %, parens, integer literals, and the
// single identifier "n" — nothing else is accepted).
// ---------------------------------------------------------------------------

const MAX_EXPRESSION_LENGTH = 2000;
const MAX_NESTING_DEPTH = 64;

type TokenType =
  | "number"
  | "ident"
  | "?"
  | ":"
  | "&&"
  | "||"
  | "=="
  | "!="
  | "<="
  | ">="
  | "<"
  | ">"
  | "%"
  | "("
  | ")";

interface Token {
  type: TokenType;
  value?: number;
}

class PluralFormsParseError extends Error {}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < expr.length && expr[j] >= "0" && expr[j] <= "9") j += 1;
      tokens.push({ type: "number", value: Number(expr.slice(i, j)) });
      i = j;
      continue;
    }
    if (ch === "n") {
      // Only the single identifier "n" is ever valid — anything longer is a
      // hard parse error (guards against e.g. "constructor"-style tokens).
      const next = expr[i + 1];
      if (next !== undefined && /[A-Za-z0-9_]/.test(next)) {
        throw new PluralFormsParseError(`Unexpected identifier at position ${i}.`);
      }
      tokens.push({ type: "ident" });
      i += 1;
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (
      two === "&&" ||
      two === "||" ||
      two === "==" ||
      two === "!=" ||
      two === "<=" ||
      two === ">="
    ) {
      tokens.push({ type: two });
      i += 2;
      continue;
    }
    if (
      ch === "?" ||
      ch === ":" ||
      ch === "<" ||
      ch === ">" ||
      ch === "%" ||
      ch === "(" ||
      ch === ")"
    ) {
      tokens.push({ type: ch });
      i += 1;
      continue;
    }
    throw new PluralFormsParseError(`Unexpected character "${ch}" at position ${i}.`);
  }
  return tokens;
}

type Ast =
  | { kind: "n" }
  | { kind: "num"; value: number }
  | { kind: "ternary"; cond: Ast; then: Ast; else: Ast }
  | {
      kind: "binary";
      op: "&&" | "||" | "==" | "!=" | "<=" | ">=" | "<" | ">" | "%";
      left: Ast;
      right: Ast;
    };

class Parser {
  private tokens: Token[];
  private pos = 0;
  private depth = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new PluralFormsParseError("Unexpected end of expression.");
    this.pos += 1;
    return token;
  }

  private expect(type: TokenType): void {
    const token = this.next();
    if (token.type !== type) throw new PluralFormsParseError(`Expected "${type}".`);
  }

  private enter<T>(fn: () => T): T {
    this.depth += 1;
    if (this.depth > MAX_NESTING_DEPTH)
      throw new PluralFormsParseError("Expression nested too deeply.");
    try {
      return fn();
    } finally {
      this.depth -= 1;
    }
  }

  parse(): Ast {
    const ast = this.ternary();
    if (this.pos !== this.tokens.length)
      throw new PluralFormsParseError("Trailing input after expression.");
    return ast;
  }

  private ternary(): Ast {
    return this.enter(() => {
      const cond = this.logicalOr();
      if (this.peek()?.type === "?") {
        this.next();
        const thenBranch = this.ternary();
        this.expect(":");
        const elseBranch = this.ternary();
        return { kind: "ternary", cond, then: thenBranch, else: elseBranch };
      }
      return cond;
    });
  }

  private logicalOr(): Ast {
    return this.enter(() => {
      let left = this.logicalAnd();
      while (this.peek()?.type === "||") {
        this.next();
        left = { kind: "binary", op: "||", left, right: this.logicalAnd() };
      }
      return left;
    });
  }

  private logicalAnd(): Ast {
    return this.enter(() => {
      let left = this.equality();
      while (this.peek()?.type === "&&") {
        this.next();
        left = { kind: "binary", op: "&&", left, right: this.equality() };
      }
      return left;
    });
  }

  private equality(): Ast {
    return this.enter(() => {
      let left = this.relational();
      while (this.peek()?.type === "==" || this.peek()?.type === "!=") {
        const op = this.next().type as "==" | "!=";
        left = { kind: "binary", op, left, right: this.relational() };
      }
      return left;
    });
  }

  private relational(): Ast {
    return this.enter(() => {
      let left = this.modulo();
      while (["<", "<=", ">", ">="].includes(this.peek()?.type ?? "")) {
        const op = this.next().type as "<" | "<=" | ">" | ">=";
        left = { kind: "binary", op, left, right: this.modulo() };
      }
      return left;
    });
  }

  private modulo(): Ast {
    return this.enter(() => {
      let left = this.primary();
      while (this.peek()?.type === "%") {
        this.next();
        left = { kind: "binary", op: "%", left, right: this.primary() };
      }
      return left;
    });
  }

  private primary(): Ast {
    return this.enter(() => {
      const token = this.next();
      if (token.type === "number") return { kind: "num", value: token.value ?? 0 };
      if (token.type === "ident") return { kind: "n" };
      if (token.type === "(") {
        const inner = this.ternary();
        this.expect(")");
        return inner;
      }
      throw new PluralFormsParseError(`Unexpected token "${token.type}".`);
    });
  }
}

function evaluateAst(ast: Ast, n: number): number {
  switch (ast.kind) {
    case "n":
      return n;
    case "num":
      return ast.value;
    case "ternary":
      return evaluateAst(ast.cond, n) !== 0 ? evaluateAst(ast.then, n) : evaluateAst(ast.else, n);
    case "binary": {
      const left = evaluateAst(ast.left, n);
      const right = evaluateAst(ast.right, n);
      switch (ast.op) {
        case "&&":
          return left !== 0 && right !== 0 ? 1 : 0;
        case "||":
          return left !== 0 || right !== 0 ? 1 : 0;
        case "==":
          return left === right ? 1 : 0;
        case "!=":
          return left !== right ? 1 : 0;
        case "<=":
          return left <= right ? 1 : 0;
        case ">=":
          return left >= right ? 1 : 0;
        case "<":
          return left < right ? 1 : 0;
        case ">":
          return left > right ? 1 : 0;
        case "%":
          return right === 0 ? 0 : left % right;
      }
    }
  }
}

const PLURAL_FORMS_PATTERN = /nplurals\s*=\s*(\d+)\s*;\s*plural\s*=\s*([^;]+);?/;

/**
 * Parses a Plural-Forms header value into a safe, evaluatable spec. Never
 * throws: any failure (missing/malformed header, oversized expression,
 * nplurals out of a sane range, a parse error in the expression) falls back
 * to ENGLISH_PLURAL_FORMS with a reason, so a hostile or malformed .po file
 * degrades gracefully instead of breaking the whole document load.
 */
export function parsePluralForms(headerValue: string | undefined): ParsePluralFormsResult {
  if (!headerValue) {
    return { spec: ENGLISH_PLURAL_FORMS, fallbackReason: "Missing Plural-Forms header." };
  }
  if (headerValue.length > MAX_EXPRESSION_LENGTH) {
    return { spec: ENGLISH_PLURAL_FORMS, fallbackReason: "Plural-Forms header is too long." };
  }
  const match = PLURAL_FORMS_PATTERN.exec(headerValue);
  if (!match) {
    return { spec: ENGLISH_PLURAL_FORMS, fallbackReason: "Could not parse Plural-Forms header." };
  }
  const nplurals = Number(match[1]);
  if (!Number.isInteger(nplurals) || nplurals < 1 || nplurals > 20) {
    return { spec: ENGLISH_PLURAL_FORMS, fallbackReason: `nplurals=${match[1]} is out of range.` };
  }
  try {
    const ast = new Parser(tokenize(match[2].trim())).parse();
    return { spec: { nplurals, evaluate: (n: number) => evaluateAst(ast, n) } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      spec: ENGLISH_PLURAL_FORMS,
      fallbackReason: `Could not evaluate plural expression: ${reason}`,
    };
  }
}

// ---------------------------------------------------------------------------
// gettext-index <-> CLDR-category bridging.
// ---------------------------------------------------------------------------

export type GettextIndexToCldr = Record<number, PluralCategory>;

/**
 * For each gettext plural index, finds the CLDR category real cardinal
 * numbers landing on that index most often select, by sampling n=0..sampleMax
 * and comparing spec.evaluate(n) against Intl.PluralRules(targetLocale). This
 * is a heuristic (gettext's Plural-Forms and CLDR arose independently and
 * aren't guaranteed to agree on every n), not an exact derivation — the same
 * method real translation platforms use. Never throws; an index with zero
 * samples in range defaults to "other".
 */
export function bridgeGettextToCldr(
  spec: PluralFormsSpec,
  targetLocale: string,
  options: { sampleMax?: number } = {},
): GettextIndexToCldr {
  const sampleMax = options.sampleMax ?? 199;
  const rules = new Intl.PluralRules(targetLocale, { type: "cardinal" });
  const counts = new Map<number, Map<PluralCategory, number>>();
  for (let n = 0; n <= sampleMax; n++) {
    const index = spec.evaluate(n);
    const category = rules.select(n) as PluralCategory;
    const byCategory = counts.get(index) ?? new Map<PluralCategory, number>();
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    counts.set(index, byCategory);
  }

  const map: GettextIndexToCldr = {};
  for (let index = 0; index < spec.nplurals; index++) {
    const byCategory = counts.get(index);
    if (!byCategory || byCategory.size === 0) {
      map[index] = "other";
      continue;
    }
    let best: PluralCategory = "other";
    let bestCount = -1;
    for (const category of CANONICAL_PLURAL_ORDER) {
      const count = byCategory.get(category) ?? 0;
      if (count > bestCount) {
        best = category;
        bestCount = count;
      }
    }
    map[index] = best;
  }
  return map;
}

/** Inverse of bridgeGettextToCldr's map — first-writer-wins by ascending gettext index on a tie. */
export function bridgeCldrToGettext(
  map: GettextIndexToCldr,
): Partial<Record<PluralCategory, number>> {
  const inverse: Partial<Record<PluralCategory, number>> = {};
  for (const [indexText, category] of Object.entries(map)) {
    if (inverse[category] === undefined) inverse[category] = Number(indexText);
  }
  return inverse;
}
