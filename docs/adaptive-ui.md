# Adaptive UI

Notes on the pass that brought the React rewrite to parity with the single-file
prototype, took it to phones, and then moved chrome onto shadcn + Tailwind.
Most of these changes look like styling and are not: several exist to hold a
measured property, and undoing one quietly costs that property back.

Measurements below come from a headless Chromium driven over the DevTools
Protocol against a large synthetic `.lang` fixture (~6500 entries in
`test/fixtures/synthetic-large.lang`) — not from copyrighted game files and not
from estimates.

## Visual parity

`src/index.css` used to hold the whole chrome (~2122 lines). After the shadcn
migration it is tokens only (~349 lines):

- `@import` chain (Tailwind, tw-animate, shadcn, Geist, theme-switcher)
- four `@custom-variant`s: `dark`, `compact`, `kb-open`, `kb-cramped`
- `@utility ltr-isolate`
- `@theme inline` + derived workspace tokens + the hand-tuned dungeon palette
- base resets, `#root` with `--keyboard-inset`, attention-pulse keyframes
- scrollbars and the RTL plaintext rules for inputs/textareas

Layout and controls live as Tailwind utilities on the components. Standard
forms use shadcn primitives (`Button`, `Input` / `InputGroup`, `Select`,
`Switch`, `Badge`, `Empty`, `Sidebar`, `Popover`, `Sheet`, `Tabs`, …). Long
`className` lists are split with `cn()`, one grouped string per line.

One deliberate difference from the prototype: the virtualised lists do **not**
get `scroll-behavior: smooth`. A jump crosses thousands of unrendered rows;
animating it scrolls through blank space, and the measurement pass restarts the
animation on every frame. A section jump never arrived until this was removed.

Controls share shadcn's default **`h-8`** (not the prototype's 34 px). That is
intentional: shadcn defaults win over pixel parity so every control in a bar
stays one height without a custom rule.

## Colours

`shadcn-theme-switcher` supplies the palettes (16 upstream, of which 8 are
enabled in `src/themes/themes.ts`); the library is a dependency rather than a
vendored palette file so the palettes track upstream. Dungeon is the default and
the only hand-written palette.

Traps worth remembering:

- **Palette scoping.** Dungeon is scoped to
  `:root:not([data-theme]), :root[data-theme="dungeon"], [data-theme="dungeon"]`.
  Written as plain `:root` it wins over every imported palette and light mode
  comes out amber.
- **`color-mix` percentages must total 100.** Any shortfall silently becomes
  alpha: `color-mix(in oklab, var(--card) 85%, var(--foreground) 4%)` produces a
  colour at `0.89` opacity, which is why the header once looked translucent.
- **`--primary-soft` is derived from `--primary`, not `--accent`.** A palette
  may make accent a second saturated hue (Catppuccin pairs purple primary with
  cyan accent); primary ink on an accent tile then clashes. Soft washes for
  active tiles share `--primary-soft`.
- **Ghost / outline hover uses `--accent`.** On dungeon, `--muted` is almost the
  same as the card/background, so `hover:bg-muted` was invisible. Secondary
  buttons mix a little `--primary` into the fill on hover for the same reason.

No component hard-codes a palette colour. Status icons take token classes.

## Virtualised lists

A `.lang` file runs to thousands of entries, and rendering them all made every
store update — a keystroke, a theme switch — walk the whole tree. Theme
switching alone froze the page.

`src/components/layout/VirtualList.tsx` renders only the visible window
(`LIST_CLASS` is shared by editor, review and diff). Roughly a dozen cards
instead of thousands; theme switch stays interactive.

Load-bearing rules:

- **`estimateSize` must keep a stable identity between real metric changes.**
  Recreated inline on each render it invalidates the virtualiser every frame.
- **When the estimator identity *does* change** (calibration landing, font /
  width recalibration), call `virtualizer.measure()`. TanStack's
  `getMeasurements` memo does not depend on `estimateSize`, so without an
  explicit invalidate the total height stays on the fallback (~168 px) until
  every row mounts — the list "grows" as you scroll (~25 % drift). After the
  invalidate, full-pass drift is under 1 % (~0.23 % on the synthetic large
  fixture).
- **`EntryCard` is memoised.** Without it, one store update re-renders every
  card in the window.
- **`contain: layout style paint` on row wrappers.** A single card mounting
  otherwise invalidates style for the whole list.

**Row heights are predicted, not guessed.** Shared geometry strings live in
`src/features/editor/card-classes.ts`. `card-metrics.ts` builds its hidden probe
from those same strings (plus `buttonVariants` / `badgeVariants`), so the card
and the probe cannot drift apart. `src/core/layout/text-wrap.ts` predicts
wrapped text with canvas `measureText` plus greedy word wrap. Heights are
cached per entry, keyed by a fingerprint of what can change them.

Section jumps land on the first try once the calibrated total is in place
(`scrollToIndex` with a short rAF settle).

## Responsive

The header used to hold a dozen controls; on a phone the row overflowed to
565 px on a 390 px screen.

- **`WorkspaceMenu`** (Sheet) holds everything that is not progress or export:
  file, progress, editing toggles, machine translation, appearance, tools.
- **`AppHeader`** keeps brand, meter with save dot, and a pair of icon buttons —
  export and menu — at the trailing edge.
- **Filter rail** is a shadcn `Sidebar` with `collapsible="icon"`, open state in
  `necesse-translator.sidebar-collapsed.v1`. Compact view **unmounts** the rail
  instead of hiding it — the layout gap that reserves its width is a sibling of
  the panel, so `display:none` alone leaves a hole. Local patches in
  `sidebar.tsx` keep the provider/panel inside the workspace row (`absolute` /
  `h-full`) rather than the viewport; a future `shadcn add sidebar` will
  clobber those.
- **`BarOptions`** is a `Popover` (`modal={false}`). Wide screens show children
  inline; below 860 px they drop into the panel. The hand-rolled portal and
  `getBoundingClientRect` positioning are gone. The bars no longer scroll
  horizontally — a scrolling bar carried the popover trigger off the right edge
  of a 390 px screen.

Horizontal overflow 565 → 390 px on a phone-sized viewport. The save state is a
dot next to the progress it describes, with wording in its tooltip and in the
menu, rather than a pill that changes width while saving.

## Diff

**The alignment bug was not about hiding lines.** `lcsPairs` returns `null` when
`left × right` exceeds its matrix limit (1.5 M cells). Any file over roughly
1225 lines therefore got no alignment at all and every row was flagged as
changed — "only differences" had nothing to hide because nothing was equal.

`alignRegion` in `src/core/compare/token-aware-diff.ts` fixes it in three steps:
trim the common prefix and suffix (for similar files this alone does most of the
work), split what remains on unique anchor lines — lines occurring exactly once
on both sides, ordered by longest increasing subsequence, as patience diff does —
and run the exact LCS only on the small regions that survive. Guarded by
`src/core/compare/large-file-alignment.test.ts` against
`test/fixtures/synthetic-large.lang` (regenerate with `npm run generate:fixtures`).

Collapsing keeps `DIFF_CONTEXT = 3` equal lines either side of every change, and
leaves short runs alone. The grid is a **flex** row per virtual item: fixed-width
gutters + two `flex-1 min-w-0` panes. Plain CSS grid `1fr` tracks sized to
min-content per row, so gutters wandered sideways on a phone; flex keeps them
aligned without clipping wrapped text. Stats use `Badge`; empty / identical
states use shadcn `Empty` cards.

## Mobile keyboard

Phones do not resize the page when the keyboard opens; they cover it. A shell
sized to `100%` keeps laying out behind the keys and the card under the caret
disappears.

`src/hooks/use-keyboard-inset.ts` reads the covered strip from the visual
viewport, publishes it as `--keyboard-inset`, and `#root` shrinks to the space
that is actually visible. The focused row is found by
`[data-slot="entry-card"], [data-slot="review-row"]`, then scrolled into what
remains — by the minimum needed if it fits, top-aligned if it does not
(`src/core/layout/keyboard-reveal.ts`, unit-tested).

| | 390 × 844, keyboard 336 | 375 × 667, keyboard 300 |
| --- | --- | --- |
| card before | 625–844 (cut off) | 395–614 (cut off) |
| card after | 281–500 | 140–359 |
| visible area | 177–508 | 101–367 |

Below 460 px of remaining height the header also stands down
(`html.keyboard-cramped` / `kb-cramped:`). The footnote hides whenever the
keyboard is up (`kb-open:`). Both come back on blur.

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

Chunks move at different rates (`manualChunks` in `vite.config.ts`). Approximate
sizes after the shadcn migration:

| chunk | raw | gzip |
| --- | --- | --- |
| locales | 216 kB | 62 kB |
| react | 194 kB | 61 kB |
| index (app) | 137 kB | 39 kB |
| vendor | 115 kB | 36 kB |
| radix | 113 kB | 35 kB |
| icons | 14 kB | 3 kB |

React and the renderer stay in one chunk — they share module-level state, and
splitting them raises questions about initialisation order for no benefit.

Known headroom: all 29 interface locales are bundled eagerly (`import.meta.glob`
with `eager: true` in `src/features/i18n/locale-registry.ts`). Their own chunk
helps caching but not first load; making them lazy is a separate change.

## Measuring

There is no Playwright here. Drive headless Chromium with
`--remote-debugging-port` over a raw WebSocket (Node 22 has a global
`WebSocket`): `Emulation.setDeviceMetricsOverride` for device sizes,
`Runtime.evaluate` for measurements, `Page.captureScreenshot` for the visual
pass. Load a file by pushing a `File` into `#fileInput` via `DataTransfer` and
dispatching `change`. Prefer committed fixtures under `test/fixtures/` over
gitignored `test/locals/`.

Keyboard tests stub `window.visualViewport` through
`Page.addScriptToEvaluateOnNewDocument`, since headless Chromium has no
on-screen keyboard.

Sizes worth checking: 1280×800, 860×900, 390×844, 375×667. Horizontal overflow
must not exceed the viewport at any of them.

One caveat learned the hard way: while `src/index.css` is being edited heavily,
the Vite dev server can serve stale CSS, and measurements taken against it are
wrong in a way that looks like a broken rule. Restart the dev server before
trusting a computed-style measurement.
