# Adaptive UI

Notes on the pass that brought the React rewrite to parity with the single-file
prototype and then took it to phones. Written down because most of these changes
look like styling and are not: several of them exist to hold a measured property,
and undoing one quietly costs that property back.

Measurements below come from a headless Chromium driven over the DevTools
Protocol against the real `ru.lang` (7472 entries) — not from estimates.

## Visual parity

Chrome used to live as a pile of selectors in `src/index.css`. That file is now
tokens only: the four `@custom-variant`s, `@utility ltr-isolate`, `@theme`, the
derived / dungeon palettes, base resets, `#root` with `--keyboard-inset`, the
attention-pulse keyframes, scrollbars, and the RTL plaintext rules. Layout and
controls live as Tailwind utilities on the components, with shadcn primitives
for buttons, inputs, badges, empty states and the like.

One deliberate difference from the prototype: the virtualised lists do **not**
get `scroll-behavior: smooth`. A jump crosses thousands of unrendered rows;
animating it scrolls through blank space, and the measurement pass restarts the
animation on every frame. A section jump never arrived until this was removed.

## Colours

`shadcn-theme-switcher` supplies the palettes (16 of them, of which 8 are
enabled in `src/themes/themes.ts`); the library is a dependency rather than a
vendored palette file so the palettes track upstream. Dungeon is the default and
the only hand-written palette.

Two traps worth remembering:

- **Palette scoping.** Dungeon is scoped to
  `:root:not([data-theme]), :root[data-theme="dungeon"], [data-theme="dungeon"]`.
  Written as plain `:root` it wins over every imported palette and light mode
  comes out amber.
- **`color-mix` percentages must total 100.** Any shortfall silently becomes
  alpha: `color-mix(in oklab, var(--card) 85%, var(--foreground) 4%)` produces a
  colour at `0.89` opacity, which is why the header once looked translucent.

No component hard-codes a colour. Icons that used to carry their own colour take
an accent token instead.

## Virtualised lists

A `.lang` file runs to thousands of entries, and rendering them all made every
store update — a keystroke, a theme switch — walk the whole tree. Theme
switching alone froze the page.

`src/components/layout/VirtualList.tsx` renders only the visible window: 10–11
cards instead of 7472, theme switch down to 61 ms.

Three things keep it smooth, and all three are load-bearing:

- **`estimateSize` must be a stable callback.** Recreated inline on each render
  it invalidates the virtualiser's measurement cache every time.
- **`EntryCard` is memoised.** Without it, one store update re-renders every
  card in the window.
- **`contain: layout style paint` on row wrappers.** A single card mounting
  otherwise invalidates style for the whole list.

Before: 29 dropped frames out of 179 during a fling, p90 frame 33.3 ms. After:
0 dropped, p90 16.7 ms.

**Row heights are predicted, not guessed.** `src/features/editor/card-metrics.ts`
calibrates card geometry once from a hidden probe element, and
`src/core/layout/text-wrap.ts` predicts wrapped text height with canvas
`measureText` plus greedy word wrap. Heights are cached per entry, keyed by a
fingerprint of what can change them, and recomputed only when the text does.
This is what stops the scrollbar jumping: a flat estimate makes total height
drift as real measurements arrive. Accuracy over 2343 sampled rows: 0.38 px
worst case, total-height drift 0.00 %.

## Responsive

The header used to hold a dozen controls; on a phone the row overflowed to
565 px on a 390 px screen.

- **`WorkspaceMenu`** (sheet) holds everything that is not progress or export:
  file, progress, editing toggles, machine translation, appearance, tools.
- **`AppHeader`** keeps brand, meter with save dot, and a pair of icon buttons —
  export and menu — at the trailing edge.
- **`BarOptions`** does the same for the per-view toolbars. On a wide screen it
  renders its children inline; on a phone they drop into a panel pinned under
  the bar. It is portalled and positioned from the bar's `getBoundingClientRect()`
  because the bars scroll horizontally and would clip a nested child. There is no
  overlay and no blur: the search field and the list stay visible and usable
  behind the panel.

Horizontal overflow 565 → 390 px, header 164 → 76 px, all three control bars
exactly 390 px. Controls in a bar share one 34 px height — they read as a single
row of peers only if they actually are one.

The save state is a dot next to the progress it describes, with wording in its
tooltip and in the menu, rather than a pill that changes width while saving.

## Diff

**The alignment bug was not about hiding lines.** `lcsPairs` returns `null` when
`left × right` exceeds its matrix limit (1.5 M cells). Any file over roughly
1225 lines therefore got no alignment at all and every row was flagged as
changed — "only differences" had nothing to hide because nothing was equal.
Comparing a file against its own export gave `equal: 0, changed: 7837`.

`alignRegion` in `src/core/compare/token-aware-diff.ts` fixes it in three steps:
trim the common prefix and suffix (for similar files this alone does most of the
work), split what remains on unique anchor lines — lines occurring exactly once
on both sides, ordered by longest increasing subsequence, as patience diff does —
and run the exact LCS only on the small regions that survive. Same comparison
now: `equal: 7837, changed: 0`, in 2 ms. Guarded by
`src/core/compare/large-file-alignment.test.ts`.

Collapsing keeps `DIFF_CONTEXT = 3` equal lines either side of every change, and
leaves short runs alone — hiding two lines to save two lines helps nobody. A
real file renders 21 rows instead of 7837.

## Mobile keyboard

Phones do not resize the page when the keyboard opens; they cover it. A shell
sized to `100%` keeps laying out behind the keys and the card under the caret
disappears.

`src/hooks/use-keyboard-inset.ts` reads the covered strip from the visual
viewport, publishes it as `--keyboard-inset`, and `#root` shrinks to the space
that is actually visible. The focused card is then scrolled into what remains —
by the minimum needed if it fits, top-aligned if it does not
(`src/core/layout/keyboard-reveal.ts`, unit-tested).

| | 390 × 844, keyboard 336 | 375 × 667, keyboard 300 |
| --- | --- | --- |
| card before | 625–844 (cut off) | 395–614 (cut off) |
| card after | 281–500 | 140–359 |
| visible area | 177–508 | 101–367 |

Below 460 px of remaining height the header also stands down
(`html.keyboard-cramped`) — on a small phone there is otherwise no room for a
whole card. The footnote hides whenever the keyboard is up. Both come back on
blur.

Focus moving from one card to the next blurs before it focuses, so the inset
collapse is deferred by 100 ms; without that the whole shell bounces between
taps.

## State updates

`toast.success` inside a `setState` updater fired three times per reference-file
load. React may run an updater more than once, so a state updater may not have
side effects — the transform and the report both moved outside it in
`loadReferenceFile`. `stateRef` exists for handlers that must read current state
*and* report on it; reading it in the same synchronous block as the `setState`
call makes it equivalent to a functional update.

## Bundle

One 738 kB chunk meant every release invalidated the whole download. Split along
the lines that move at different rates (`manualChunks` in `vite.config.ts`):

| chunk | raw | gzip |
| --- | --- | --- |
| locales | 213 kB | 62 kB |
| react | 194 kB | 61 kB |
| vendor | 115 kB | 36 kB |
| index (app) | 107 kB | 32 kB |
| radix | 97 kB | 31 kB |
| icons | 12 kB | 3 kB |

React and the renderer stay in one chunk — they share module-level state, and
splitting them raises questions about initialisation order for no benefit.

Known headroom: all 29 interface locales are bundled eagerly (`import.meta.glob`
with `eager: true` in `src/features/i18n/locale-registry.ts`). Their own chunk
helps caching but not first load; making them lazy is a separate change.

## Measuring

There is no Playwright here. The checks above were run by spawning headless
Chromium with `--remote-debugging-port` and driving it over a raw WebSocket:
`Emulation.setDeviceMetricsOverride` for device sizes,
`Runtime.evaluate` for measurements, `Page.captureScreenshot` for the visual
pass. The keyboard tests stub `window.visualViewport` through
`Page.addScriptToEvaluateOnNewDocument`, since headless Chromium has no
on-screen keyboard.

One caveat learned the hard way: while `src/index.css` is being edited heavily,
the Vite dev server can serve stale CSS, and measurements taken against it are
wrong in a way that looks like a broken rule. Restart the dev server before
trusting a computed-style measurement.
