// SPDX-License-Identifier: AGPL-3.0-or-later
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createWrapMeasurer, type WrapMeasurer } from "@/core/layout/text-wrap";
import type { TranslationEntry } from "@/core/lang/status";
import { metadataGuidanceFor } from "@/core/metadata/guidance";
import {
  CARD_CLASS,
  CARD_ROW_GAP_CLASS,
  ENTRY_BADGE_CLASS,
  GUIDE_CLASS,
  KEY_CLASS,
  OLABEL_CLASS,
  ORIG_CLASS,
  ORIG_INLINE_PADDING,
  ROW1_CLASS,
  ROW3_CLASS,
  TEXTAREA_BASE_GEOMETRY,
  TEXTAREA_CLASS,
  WARNLINE_CLASS,
} from "@/features/editor/card-classes";

/**
 * Precomputed entry-card heights for the virtual list.
 *
 * The alternative — letting the virtualizer discover heights as rows mount —
 * makes the scroll geometry shift under a fast fling. So the card is calibrated
 * once against the real DOM (fonts, paddings and the user's font settings all
 * apply), and every row's height is then derived arithmetically from that.
 */
export interface CardMetrics {
  /** A card with no source block, guidance or warnings, including its margin. */
  chrome: number;
  /** The source block minus its text lines. */
  origBase: number;
  origLine: number;
  /** Guidance block minus its text lines (includes bottom margin once). */
  guideBase: number;
  guideLine: number;
  warnLine: number;
  wrap: WrapMeasurer;
  /** Wrapping for the guidance line (`ⓘ …`), at the card's content width. */
  wrapGuide: WrapMeasurer;
}

/** pt 22 + text-xs line (~18) + pb 12 + CARD_ROW_GAP 10. */
export const SECTION_HEAD_HEIGHT = 62;

function outerHeight(element: Element) {
  const style = getComputedStyle(element);
  return (
    (element as HTMLElement).offsetHeight +
    parseFloat(style.marginTop || "0") +
    parseFloat(style.marginBottom || "0")
  );
}

const chip = buttonVariants({ variant: "outline", size: "xs" });
const badge = badgeVariants({ variant: "default" });
const textarea = `${TEXTAREA_BASE_GEOMETRY} ${TEXTAREA_CLASS}`;

/**
 * Built from the very strings the card renders with (`card-classes.ts`) rather
 * than a parallel copy, so the two cannot drift. The only hand-written part is
 * TEXTAREA_BASE_GEOMETRY — a bare <textarea> does not get the shadcn component's
 * own classes.
 */
const PROBE_HTML = `
  <div class="${CARD_ROW_GAP_CLASS}" data-probe="chrome">
    <article class="${CARD_CLASS}">
      <div class="${ROW1_CLASS}"><button class="${KEY_CLASS}">key</button><span class="${badge} ${ENTRY_BADGE_CLASS}">x</span></div>
      <textarea class="${textarea}"></textarea>
      <div class="${ROW3_CLASS}"><button class="${chip}">MT</button></div>
    </article>
  </div>
  <article class="${CARD_CLASS}">
    <div class="${ORIG_CLASS}" data-probe="orig1"><span class="${OLABEL_CLASS}">L</span><span data-probe="text1">one</span></div>
  </article>
  <article class="${CARD_CLASS}">
    <div class="${ORIG_CLASS}" data-probe="orig2"><span class="${OLABEL_CLASS}">L</span><span>one<br>two<br>three</span></div>
  </article>
  <article class="${CARD_CLASS}"><div class="${GUIDE_CLASS}" data-probe="guide1">g</div></article>
  <article class="${CARD_CLASS}"><div class="${GUIDE_CLASS}" data-probe="guide3">one<br>two<br>three</div></article>
  <article class="${CARD_CLASS}"><div class="${WARNLINE_CLASS}" data-probe="warn">w</div></article>
`;

/**
 * Measures a hidden copy of each card part inside the real list, so the numbers
 * reflect the active theme, font settings and container width.
 */
export function calibrateCardMetrics(listElement: HTMLElement): CardMetrics | null {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:100%;z-index:-1";
  probe.innerHTML = PROBE_HTML;
  listElement.appendChild(probe);

  try {
    const pick = (name: string) => probe.querySelector(`[data-probe="${name}"]`);
    const chromeCard = pick("chrome");
    const origBlock1 = pick("orig1");
    const origBlock2 = pick("orig2");
    const guideBlock1 = pick("guide1");
    const guideBlock3 = pick("guide3");
    const warnBlock = pick("warn");
    const textSpan = pick("text1") as HTMLElement | null;
    if (
      !chromeCard ||
      !origBlock1 ||
      !origBlock2 ||
      !guideBlock1 ||
      !guideBlock3 ||
      !warnBlock ||
      !textSpan
    )
      return null;

    const chrome = outerHeight(chromeCard);
    const one = outerHeight(origBlock1);
    const three = outerHeight(origBlock2);
    const origLine = (three - one) / 2;
    const origBase = one - origLine;

    const guideOne = outerHeight(guideBlock1);
    const guideThree = outerHeight(guideBlock3);
    const guideLine = (guideThree - guideOne) / 2;
    const guideBase = guideOne - guideLine;
    const warnLine = outerHeight(warnBlock);

    const textStyle = getComputedStyle(textSpan);
    const font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize} / ${textStyle.lineHeight} ${textStyle.fontFamily}`;
    const textWidth = (origBlock1 as HTMLElement).clientWidth - ORIG_INLINE_PADDING * 2;

    const guideStyle = getComputedStyle(guideBlock1);
    const guideFont = `${guideStyle.fontStyle} ${guideStyle.fontWeight} ${guideStyle.fontSize} / ${guideStyle.lineHeight} ${guideStyle.fontFamily}`;
    const guideWidth = (guideBlock1 as HTMLElement).clientWidth;

    if (
      !(origLine > 0) ||
      !(guideLine > 0) ||
      !(chrome > 0) ||
      !(textWidth > 0) ||
      !(guideWidth > 0)
    )
      return null;

    return {
      chrome,
      origBase,
      origLine,
      guideBase,
      guideLine,
      warnLine,
      wrap: createWrapMeasurer(font, textWidth),
      wrapGuide: createWrapMeasurer(guideFont, guideWidth),
    };
  } finally {
    probe.remove();
  }
}

/**
 * Per-entry height cache. Keyed by entry id and invalidated only when something
 * that affects height actually changes — the source text, the warning count —
 * so ordinary typing never triggers a recompute.
 */
export class CardHeightCache {
  private readonly cache = new Map<number, { fingerprint: string; height: number }>();

  constructor(
    private readonly metrics: CardMetrics,
    /** Resolves i18n keys the same way the card renders guidance. */
    private readonly translate: (key: string) => string,
  ) {}

  heightOf(entry: TranslationEntry, warningCount: number) {
    const reference = entry.ref ?? (entry.wasMissing ? entry.english : null);
    const rule = metadataGuidanceFor(entry);
    // Card renders `ⓘ ${t(messageKey)}` — count the same string for wrap.
    const guidanceText = rule ? `ⓘ ${this.translate(rule.messageKey)}` : null;
    const fingerprint = `${warningCount}\0${reference ?? ""}\0${guidanceText ?? ""}`;
    const cached = this.cache.get(entry.id);
    if (cached && cached.fingerprint === fingerprint) return cached.height;

    const { chrome, origBase, origLine, guideBase, guideLine, warnLine, wrap, wrapGuide } =
      this.metrics;
    let height = chrome;
    if (reference != null) height += origBase + wrap.lineCount(reference) * origLine;
    if (guidanceText != null) {
      height += guideBase + wrapGuide.lineCount(guidanceText) * guideLine;
    }
    height += warningCount * warnLine;

    this.cache.set(entry.id, { fingerprint, height });
    return height;
  }
}
