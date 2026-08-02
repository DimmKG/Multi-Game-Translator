/**
 * Off-DOM text measurement.
 *
 * Row heights are precomputed so the virtual list never has to measure while
 * scrolling. Counting characters is not good enough — proportional fonts and
 * word wrapping make it wrong by a line or two, and a row that is short by a
 * line makes cards overlap. A canvas context measures the real font, and a
 * greedy wrap reproduces what the browser does, with no layout cost.
 */

let context: CanvasRenderingContext2D | null = null;

function measuringContext(): CanvasRenderingContext2D | null {
  if (context) return context;
  if (typeof document === "undefined") return null;
  context = document.createElement("canvas").getContext("2d");
  return context;
}

export interface WrapMeasurer {
  /** Number of visual lines `text` occupies at the configured width. */
  lineCount: (text: string) => number;
}

/** Words repeat heavily across a .lang file, so their widths are worth caching. */
export function createWrapMeasurer(font: string, availableWidth: number): WrapMeasurer {
  const ctx = measuringContext();
  const widths = new Map<string, number>();

  const widthOf = (word: string) => {
    let width = widths.get(word);
    if (width === undefined) {
      width = ctx ? ctx.measureText(word).width : word.length * 7;
      widths.set(word, width);
    }
    return width;
  };

  if (ctx) ctx.font = font;
  const usable = Math.max(1, availableWidth);
  const spaceWidth = widthOf(" ");

  return {
    lineCount(text: string) {
      if (!text) return 1;
      let lines = 0;

      // "\n" in a .lang value is a literal escape, not a break; only real
      // newlines split, matching `white-space: pre-wrap`.
      for (const paragraph of text.split("\n")) {
        lines += 1;
        if (!paragraph) continue;

        let used = 0;
        for (const word of paragraph.split(" ")) {
          let wordWidth = widthOf(word);

          // A word longer than the line breaks mid-word (`word-break: break-word`).
          if (wordWidth > usable) {
            if (used > 0) {
              lines += 1;
              used = 0;
            }
            const fullLines = Math.floor(wordWidth / usable);
            lines += fullLines;
            wordWidth -= fullLines * usable;
          }

          const advance = used === 0 ? wordWidth : spaceWidth + wordWidth;
          if (used + advance > usable) {
            lines += 1;
            used = wordWidth;
          } else {
            used += advance;
          }
        }
      }
      return lines;
    },
  };
}
