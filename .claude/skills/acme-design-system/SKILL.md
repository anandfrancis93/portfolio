---
name: acme-design-system
description: Apply the Acme design system (Figma file bHCrKoBVNTfrGHG5bvtYg8, v4.1.0) to anandfrancis.com. Use whenever writing or reviewing CSS, layout, components, colour, type, spacing, radius, shadows, motion, icons or theme switching, and whenever translating a Figma frame into code.
---

# Acme design system

The Figma file is the source of truth for every visual value. Nothing on the site is
designed from taste; it is derived from a token, a text style, a component or a rule in
that file. The values are transcribed in `tokens.css` (in this folder) and the longer
reference material in `reference.md`. The Figma page map is in
`docs/design-system/figma-pages.md`; the component inventory in
`docs/design-system/components.md`.

## Principles (the file's own, and it names the cost of each)

1. **Tokens, not values.** Every visual property points at a named token. If the value you
   need is not in the set, that is a gap: name it and add it. It is never a licence to type
   a number. Component CSS contains no hex codes, no pixel values and no timings.
2. **Verified, not assumed.** Anything a script can check, a script checks, and the script
   may fail the build. Judgement is reserved for what a machine cannot see.
3. **Correct by default beats convenient.** The out-of-the-box state is the right one.
4. **One way to do each thing.** One grid, one type ramp, one spacing scale, one motion
   scale. Variety is a deliberate decision, never a side effect.
5. **Never colour alone.** Colour carries emphasis, never meaning by itself. A word, a
   shape or an icon says it too.
6. **Movement explains, it does not decorate.** If removing an animation loses no
   information, it should not be there.
7. **Generated, not retyped.** Token files are generated from one source; a second copy
   would drift.

## How tokens are used in code

- Semantic tokens only: `var(--color-bg-surface)`, `var(--spacing-md)`, `var(--radius-lg)`,
  `var(--shadow-md)`, `var(--duration-fast)`, `var(--ease-standard)`. Primitives such as
  gray/500 exist only for the semantic layer to point at; never reference them directly.
- Figma name to CSS name is mechanical: slashes and spaces become hyphens and the
  collection is the prefix. `bg/surface` is `--color-bg-surface`; `duration/fast` is
  `--duration-fast`; `breakpoint/md` is `--breakpoint-md`.
- Light and dark are the same variables with different values. `<html>` follows the
  operating system by default; `data-theme="dark"` or `data-theme="light"` forces one.
  No component knows which theme is active.
- Class names mirror Figma variant names: `Style=Primary` becomes `.btn--primary`,
  `Size=Large` becomes `.btn--lg`, element parts use `__`: `.btn__icon`.
- A stylelint rule forbids raw colours, lengths and durations in component stylesheets;
  the only file that may contain literals is `tokens.css`.

## Colour: every token has a job

Eleven role classes; a value must obey its class. The ones the portfolio uses:

- **Surface** (`--color-bg-canvas`, `-surface`, `-surface-raised`, `-subtle`, `-hover`,
  `-active`, `-disabled`): greys only. Page background is canvas, cards and header are
  surface, hover steps to `bg-hover`, pressed to `bg-active`.
- **Neutral text** (`--color-text-primary`, `-secondary`, `-tertiary`, `-disabled`): greys
  only. Body text never borrows a chromatic ramp. Headings primary, body secondary,
  metadata tertiary.
- **Text ink** (`--color-text-link`, `--color-brand-text`, `--color-code-ink` and the
  status texts): coloured text certified at 4.5:1 in both themes. Eyebrow labels
  (EXPERIENCE, SKILLS) use `brand-text`. Inline code uses `code-ink`, a violet reserved for
  code and nothing else.
- **Solid** (`--color-brand-solid`, `-solid-hover`, `-solid-active`, status solids): every
  solid pairs with `--color-text-on-solid` for its label. The primary button is
  `brand-solid`; there is exactly one primary button per view.
- **Tint** and **tint border** (`--color-brand-subtle`, `--color-brand-border`, status
  equivalents, `--color-neutral-subtle`): badges and quiet panels. In dark mode tints are
  dedicated near-black primitives, never ramp ends.
- **Border** (`--color-border-subtle`, `-default`, `-strong`, `-focus`, `-control`): greys
  only. Dividers use subtle; anything that identifies a control uses `control`, which
  clears 3:1; focus rings use `focus`.
- **Inverse** and **theme-stable**: tooltips use inverse; terminal blocks use the terminal
  tokens, which are the same in both themes.

## Type

IBM Plex Sans for everything, IBM Plex Mono for code. One ramp, fourteen styles, set in
`tokens.css` as `--font-*` and `--text-*` tokens: Display 48/56 bold, letter-spacing -1.5px
(the template hero); H1 36/44 bold; H2 30/38 semibold, letter-spacing -0.5px; H3 24/32
semibold, letter-spacing -0.25px; H4 20/26 semibold; Body/XLarge 24/36 (pull quotes only);
Body/Large 18/28; Body/Medium 16/24; Body/Small 14/22; Label/Large 16/24 medium;
Label/Medium 14/20 medium; Label/Small 12/16 medium, letter-spacing 0.2px; Caption 12/18;
Code 14/22 mono. Body and Caption styles are weight 400. Eyebrows are Label/Small in caps
with 0.08em tracking. Each style also has a unitless `--text-*-leading` token (line divided
by size) so `line-height` scales with the text and needs no typed CSS division.

Heading levels are semantic, not visual: a role title is an `h3` wearing the H4 style.
Running text is capped at `--measure-prose` (560px, about 68 characters); sidebars and
captions at `--measure-narrow` (440px).

## Space, shape, depth

- Spacing scale: none 0, 3xs 2, 2xs 4, xs 8, sm 12, md 16, lg 24, xl 32, 2xl 40, 3xl 48,
  4xl 64. Sections pad 64 vertically on desktop; the inner column is `--container-xl`
  (1200px) centred; content gaps inside a section are 40; heading-to-body gap is 8.
- Radius: none 0, xs 4, sm 6, md 8, lg 12, xl 16, 2xl 24, full 9999. Cards and panels lg;
  buttons and inputs md; badges full.
- Shadows: sm, md, lg, xl (values in `tokens.css`). Cards at rest have none or sm; a
  raised surface uses md. Shadows are the only depth cue; no borders plus shadows on the
  same card.
- Controls: 40px (md) is the default control height; 48px (lg) for the hero actions;
  nav links are 32px tall inside 44px bars.

## Layout

Three column tiers, never a one-off column count: mobile under 768px, 4 columns, 16px
gutter, 16px margin; tablet 768 to 1023px, 8 columns, 24px gutter, 32px margin; desktop
1024px and up, 12 columns, 32px gutter, 64px margin. Breakpoints as min-width media
queries: sm 640, md 768, lg 1024, xl 1280, 2xl 1536. Containers: sm 600, md 720, lg 960,
xl 1200, 2xl 1440. The template was drawn at 390, 768 and 1440; widths between are
untested and must be checked in the browser.

## Motion

Pick a duration from how far the thing travels, an easing from whether it is arriving,
leaving or staying put. Durations: instant 0, fast 100, base 200, slow 300, slower 500 ms.
Easings: standard `cubic-bezier(0.2, 0, 0, 1)` for most UI movement; decelerate
`cubic-bezier(0, 0, 0.2, 1)` for arrivals; accelerate `cubic-bezier(0.4, 0, 1, 1)` for
exits; emphasized `cubic-bezier(0.05, 0.7, 0.1, 1)` for large transitions; overshoot
`cubic-bezier(0.34, 1.56, 0.64, 1)` for playful confirmation; linear for progress only.
Pairings: hover and focus, fast + standard; disclosure open, base + decelerate, close,
base + accelerate; large surfaces, slow + emphasized. Cycles: spin 800 ms, pulse 1600 ms,
linear only. Under `prefers-reduced-motion: reduce` every duration is 0 ms and only
opacity changes remain; state changes stay visible. Both reduced-motion blocks in
`tokens.css` ship unchanged.

## Interaction states

Eight states, defined once: default, hover (background one level, never a size change),
focus (2px ring in `border-focus`, offset 2px), pressed (one level beyond hover),
selected (brand fill plus a mark, never colour alone), disabled (`bg-disabled` and
`text-disabled`, no hover, a reason in text beside it), loading (control keeps its exact
width, spinner centred, shown only after about a second), error (2px danger border plus
a message). Rules that follow: nothing lives behind hover alone; everything clickable is
reachable by Tab in visual order; focus is always visible; targets are at least 24 by 24;
icon-only controls have a text name.

## Icons

24px grid, 1.5px stroke, round caps and joins, stroke bound to `currentColor` so icons
follow the text colour and the theme. Use only glyphs from the set (list in
`reference.md`). The portfolio needs chevron-down, chevron-up, sun, moon, mail, download,
external-link, arrow-right, menu and close. Never redraw an icon; export it from Figma.

## Template - Portfolio: implementation notes from its Read me

- Header, footer and nav-link bars are fixed heights (80, 70, 44) with centred content.
  Implement as height plus centring; the odd paddings Figma shows are artefacts.
- The cards on the template are hand-built frames, not the Card component, because Card
  has no content slot. Build a portfolio card component in code with badges and an action.
- The Experience accordion only expands in code; the prototype cannot show it.
- Only one project card, full width; there is no grid with gaps in it.
- Heading levels are semantic; see Type above.

## Reading Figma

Any page can be read by node id even though the connector lists only the Cover page. Use
`docs/design-system/figma-pages.md` for ids. Load the design-to-code guidance before
calling `get_design_context`, treat its React and Tailwind output as a reference only, and
map every `var(--...)` it emits onto the same-named token here. When a value it emits is a
raw number, find the token; if none exists, raise it as a gap rather than typing the number.
