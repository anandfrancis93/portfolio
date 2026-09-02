# Acme design system: reference material

Longer material behind `SKILL.md`, transcribed from the Figma file on 2 September 2026.
Page ids are in `docs/design-system/figma-pages.md`.

## Where each value came from

| Topic | Figma page | Node | Notes |
| --- | --- | --- | --- |
| Colour tokens, both themes | Colour | 531:2 (frames 8:2, 9:2, 399:260, 399:523) | Read with get_variable_defs on the frames |
| Colour roles | Colour | 399:260 | Eleven role classes, one per token |
| Type ramp | Typography | 531:3 | Style values win where the specimen page differs (Caption 12/18, Code 14/22, H4 20/26) |
| Spacing | Spacing | 531:4 | |
| Radius | Radius | 531:5 (frame 531:320) | |
| Shadows | Elevation | 531:6 (frame 531:476) | Read with get_design_context |
| Motion | Motion | 531:7 | |
| Layout tiers, breakpoints, containers, measure | Layouts | 50:26 | |
| Interaction states, input methods, timing, reduced motion | Interactions | 123:2 | |
| Principles | Principles | 86:2 | |
| UX laws and WCAG items | UX | 97:2 | |
| Handoff rules | Handoff | 61:2 | |
| Icons | Icons | 28:3 | |
| Portfolio template and Read me | Template - Portfolio | 588:2 (Read me 589:628) | |

## Colour roles in full

Every one of the 53 colour tokens declares exactly one of eleven role classes, and a
script fails the build when a value drifts out of its class.

- **surface** (7): bg/canvas, bg/surface, bg/surface-raised, bg/subtle, bg/hover,
  bg/active, bg/disabled. Greys only.
- **inverse** (2): bg/inverse, text/inverse. Swaps polarity across themes; for things that
  oppose their background, like tooltips.
- **themeStable** (4): terminal/bg, terminal/bg-raised, terminal/text, terminal/text-dim.
  The white-terminal law: a terminal is dark in both themes.
- **neutralText** (4): text/primary, text/secondary, text/tertiary, text/disabled.
- **textInk** (7): text/link, brand/text, info/text, success/text, warning/text,
  danger/text, code/ink. The violet-reads-black law: coloured text sits at ramp 600 to 700
  in light and 200 to 400 in dark; 800 is banned.
- **labelOnSolid** (2): text/on-solid, text/on-solid-inverse. Near-white or near-black.
- **solid** (9): brand/solid, brand/solid-hover, brand/solid-active, info/solid,
  success/solid, warning/solid, danger/solid, danger/solid-hover, danger/solid-active.
  The stranded-label law: every solid declares its label partner and the pair is checked at
  4.5:1 in both themes. All nine pair with text/on-solid.
- **indicator** (1): success/indicator. The near-black-dots law: small marks need vivid
  500 or 600 steps; a 700 dot reads as black at 8px.
- **tint** (7): brand/subtle, brand/subtle-hover, info/subtle, success/subtle,
  warning/subtle, danger/subtle, neutral/subtle. The muddy-tints law: light tints are 50 or
  100 pastels; dark tints are dedicated primitives at about 23.5% lightness.
- **tintBorder** (5): brand/border, info/border, success/border, warning/border,
  danger/border.
- **border** (5): border/subtle, border/default, border/strong, border/focus,
  border/control. Greys only; border/control clears 3:1 because it identifies a control.

Adding a colour token: pick its role class first, then a value the class allows. If no
class fits, the token is probably two tokens, or the palette is growing a new job, which is
a design decision.

## Interaction states

| State | Meaning | What changes |
| --- | --- | --- |
| Default | Resting | Baseline |
| Hover | Pointer over it | Background one level darker or lighter; never a size change |
| Focus | Keyboard on it | 2px ring in border/focus, outline offset 2px |
| Pressed | Contact | Background one level beyond hover, for the length of the press |
| Selected | A lasting choice | Brand fill plus a mark; never colour alone |
| Disabled | Cannot be used now | bg/disabled and text/disabled, no hover, no pointer, a reason in text |
| Loading | Request accepted | Exact width kept, label loses ink, spinner centred; show after about a second |
| Error | Value not acceptable | 2px danger border plus a message; the border alone is not enough |

Input methods: hover exists only for the mouse; press is mouse down, finger down, Space or
Enter, or direct activation; focus is the keyboard's primary way to move; drag needs a
non-drag alternative; screen readers only read the accessible name.

Response timing: under 100 ms show nothing extra; 100 ms to 1 s show the change itself and
disable the control; 1 s to 10 s show a busy state in place at resting size; over 10 s show
real progress and say what is happening. Reserve space before the result arrives. A toast
stays about 5 seconds; never auto-dismiss an error. Disable a submit control the moment it
is pressed. Announce changes to screen readers as well as showing them.

Reduced motion: remove movement across the screen, scale and spin; keep colour and opacity
changes; always keep the state change itself; keep loading indicators but calm them; never
autoplay.

## Icons (44, 24px grid, 1.5px stroke, round caps and joins, stroke bound to text/primary)

check, close, chevron-down, chevron-up, chevron-left, chevron-right, arrow-right,
arrow-left, arrow-up, arrow-down, plus, minus, search, settings, user, bell, mail,
calendar, clock, home, file, folder, trash, edit, download, upload, external-link, eye,
lock, info, alert-triangle, star, heart, menu, more-horizontal, filter, copy, refresh,
log-out, alert-circle, check-circle, loader, sun, moon, bookmark.

## UX laws the file already designs by, applied to the portfolio

- Hick's law: one primary button per view; three column tiers rather than six.
- Miller's law: four navigation destinations, not eleven. The template's nav is
  Experience, Projects, About, Contact.
- Fitts's law: 40 and 48px controls; whole-row targets.
- Von Restorff: exactly one primary button style; one solid badge among quiet ones.
- Jakob's law: familiar structure, distinctive content. Logo left, nav right, in the usual
  order; spend the novelty budget on the work.
- Peak-end rule: contact is read last, so it gets real design.
- Serial position effect: best project first and last; the middle is for forgettable work.
- Picture superiority: project images do the work, descriptions support them.
- Labour illusion: show process, not only finished screens.
- Aesthetic-usability effect: why the portfolio earns an expressive layer.
- Doherty threshold: every motion duration sits at 300 ms or under.
- Persuasion patterns (scarcity, countdowns, decoys, anchoring) are out of scope: on a
  personal portfolio every one of them reads as manipulation.

## WCAG 2.2 items the file says change the design

1.4.3 Contrast (4.5:1 text, 3:1 large); 1.4.11 Non-text contrast (control boundaries
3:1, border/control exists for this at 4.76:1); 1.4.1 Use of colour (never colour alone);
1.4.4 Resize text (min-height not height, unitless line-height); 2.5.8 Target size (24 by
24); 2.3.3 Animation from interactions (reduced motion); 3.3.2 Labels (a placeholder is not
a label); 1.4.10 Reflow (works at 320px; the smallest drawn tier is 390); 1.4.12 Text
spacing; 2.4.7 Focus visible on every interactive component; 2.4.11 Focus not obscured
(sticky header risk); 2.4.4 Link purpose (no five cards saying "Read more"); 1.4.13 Content
on hover or focus (tooltips dismissible, hoverable, persistent); 3.2.3 and 3.2.4
Consistency; 1.4.5 Images of text (never); 2.2.2 Pause, stop, hide (anything moving over
five seconds needs a control).

## Handoff rules

- Tokens are generated into CSS from tokens.json, never retyped. This project transcribed
  the semantic layer because tokens.json was not available; regenerate when it is.
- Primitives are authored in OKLCH with a hex fallback under `@supports not (color: oklch(0% 0 0))`;
  semantic tokens alias primitives and inherit whichever value the browser resolved.
- DESIGN.md (the design.md format from google-labs-code) is the file a coding agent
  should be pointed at; it is generated from tokens.json and design.body.md.
- The file's own toolchain: build-tokens.mjs, check-contrast.mjs (54 pairings, both
  themes, fails the build), check-design-md.mjs, check-color-roles.mjs. The portfolio
  mirrors check-contrast and the no-raw-values rule in its own CI.

## Template - Portfolio: what the Read me says

- The content is real; the links and files behind it were not at the time it was written.
- Every component, colour, type style and spacing value comes from the Acme library
  (the template was built on library version 2.2.0; the library is now 4.1.0).
- The dark board is the same board with the Color collection switched to Dark.
- No tablet-to-desktop midpoint beyond 768 and 1440; widths between are untested.
- No second project: one card at full width; no next-project link on the case study.
- The prototype is wired (157 actions). The Experience accordion only expands in code and
  keyboard focus cannot be simulated in a prototype.
- Header, footer and nav-link bars are fixed heights (80, 70, 44) with centred content.
- The cards are hand-built frames, not the Card component, which has no content slot.
- Heading levels are semantic, not visual: role, degree and certification titles are h3
  elements wearing the Heading/H4 style; the outline runs H1 > H2 > H3 without skips.

Template frames: Home Light 589:98 (1440 by 4732), Home Dark 589:363, Home Tablet 589:946
(768 by 4716), Home Mobile 589:668 (390 by 6148), Case study Desktop 589:1236, Tablet
589:1403, Mobile 589:1573, Menu Mobile 589:1746, Theme toggle 589:1231, Carousel 589:1764,
Nav link 589:1793, Read me 589:628.
