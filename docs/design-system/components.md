# Acme Design System — component reference

Source: Figma file `bHCrKoBVNTfrGHG5bvtYg8` (Acme Design System), read via `get_metadata`, `get_variable_defs` and `get_screenshot` on 2026-09-02. Every documented page carries a light "— docs" board and an identical "— Dark" duplicate; the dark boards are skipped here. Sizes are px from the component master; text slots are named by their placeholder content.

## How the portfolio template uses these

The **Template - Portfolio** page (`588:2`) Home frame is assembled from library instances of **Nav link (x4)**, **Theme toggle (x1)**, **Badge (x4)**, **Button (x4)** and **Chevron (x8)**. Its project cards are **hand-built frames, not Card instances**, because Card exposes only a title and body string and has no content slot (see Card, "Known limitation"). Two of those instance names are not among the pages documented below: *Nav link* (in the Header nav page the four links are plain text layers inside the bar, so Nav link must live elsewhere in the library) and *Chevron* (an icon). Treat both as unspecified until their pages are read.

## Shared tokens seen across components

Values below are the Light-mode resolutions returned by `get_variable_defs`; names are the CSS custom properties Figma exports (`var(--…)`). Type family is IBM Plex Sans throughout.

| Group | Token → value |
|---|---|
| text | primary `#0f172a`, secondary `#475569`, tertiary `#64748b`, disabled `#94a3b8`, on-solid `#ffffff`, inverse `#ffffff`, link `#2563eb` |
| bg | surface `#ffffff`, subtle `#f1f5f9`, hover `#e2e8f0`, active `#cbd5e1`, disabled `#f1f5f9`, inverse `#0f172a` |
| border | subtle `#e2e8f0`, default `#cbd5e1`, control `#64748b`, focus `#2563eb` |
| brand | solid `#2563eb`, solid-hover `#1848d2`, solid-active `#1838a7`, subtle `#eff6ff`, subtle-hover `#dfedff`, text `#1848d2` |
| danger | solid `#d0121a`, solid-hover `#ac030e`, solid-active `#8a030c`, text `#ac030e`, subtle `#fef2f2`, border `#ffe4e4` |
| success | solid `#006c4d`, text `#008151`, subtle `#e9faf2`, border `#cef6e2` |
| warning | solid `#914000`, text `#914000`, subtle `#f9f5e5`, border `#f7ecc0` |
| info | solid `#2563eb`, text `#1848d2`, subtle `#eff6ff`, border `#dfedff` (identical to brand) |
| neutral | subtle `#e2e8f0` |
| spacing | 3xs 2, xs 8, sm 12, md 16, lg 24 |
| size | control sm 32 / md 40 / lg 48, icon sm 16 / md 20, border-thin 1 |
| radius | md 8, lg 12, full 9999 |
| type | Label/Small 12/16 500 (ls 0.2), Label/Medium 14/20 500, Label/Large 16/24 500, Body/Small 14/22 400, Body/Medium 16/24 400, Heading/H4 20/26 600 |
| effect | Shadow/md: drop 0 4 8 −2 `#0000001A` |

---

## Header nav
- Page `543:1868`. Docs board `543:1869`; component set `537:30` (894x328); master `537:8`.
- Purpose (page prose): "The site's one persistent bar: the name as the way home, at most four destinations, the current one in brand ink. The theme toggle lives at its end. Sticky on scroll."
- Variants: property **active** = `none`, `Link 1`, `Link 3`, `Link 4` — 4 variants. There is no `active=Link 2` variant.
- Anatomy (846x72): `Full Name` text at (20,24) 96x24, rendered uppercase and letter-spaced; right cluster frame at x546 y14, 280x44 holding `Link 1`…`Link 4` (41x22 each, 65 px pitch → 24 gap) and a `Theme toggle` instance 20x44 at the end. Bar has a 1 px bottom/edge border.
- States: current link only (brand ink). No hover/focus variants.
- Tokens: text-primary, text-secondary, bg-surface, border-subtle, brand-text.
- Notes: "SPENDS · nothing. Once on every page — it is how pages admit they are one site." Screenshot (`537:30`) shows four white bars with "FULL NAME" left, links plus moon icon right; in `active=Link 1` the current link renders bold/dark rather than blue, while `Link 3`/`Link 4` render blue — an inconsistency to resolve in the build (use brand-text for all).

## Theme toggle
- Page `599:2`. Docs board `599:3`; component set `594:76`; masters `594:63`, `594:75`.
- Purpose: "One control that flips the site between light and dark. It shows the theme you would switch to: moon in light, sun in dark."
- Variants: property **Mode** = `Light` (child `Icon/moon`), `Dark` (child `Icon/sun`) — 2 variants.
- Anatomy: 20x44 frame; icon 20x20 at y12 (vertically centred). Width is only 20, so the frame is a 44 px target vertically only.
- States: none beyond Mode. No hover/focus/pressed.
- Tokens: text-primary (icon ink).
- Notes: "USAGE · one per site, at the end of the header nav. 44px tap target; the bare icon, no border." Screenshot at 20x152 rendered too small to read; anatomy taken from metadata. Gap: the 44 px tap target is not honoured horizontally by the master.

## Skip-to-content link
- Page `543:187`. Docs board `543:188`; single component `543:192` (no variants).
- Purpose: "The first tab stop, visible only on focus: keyboard and screen-reader users skip the shell instead of walking it."
- Anatomy: 125x36; text `Skip to content` at (14,8) 97x20 → padding 14 horizontal / 8 vertical, Label/Medium.
- States: only the focused presentation is drawn. Page note: "Shown focused — the 2px ring is the same focus treatment as every control."
- Tokens: text-primary, bg-surface, border-focus, Label/Medium.
- Notes: "SPENDS · nothing. Invisible until focused."

## Hero
- Page `543:1871`. Docs board `543:1872`; single component `537:39` (no variants).
- Purpose: "The home page's masthead grown to a hero: who, the one-line promise, and the single primary action. A hero states — it never slideshows."
- Anatomy (880x264): `Badge` instance 53x20 at top; `Heading` text 880x56 at y44; body paragraph 560x140 at y124 (max-width 560 for the promise).
- States: none.
- Tokens: not sampled on this master (inherits Badge tokens; heading/body styles not bound in metadata).
- Notes: "SPENDS · once, home only. Inner pages use the standard masthead." Gap: the prose promises "the single primary action" but the master contains no Button; the build must add one (the Contact section is where the page's one solid button is said to live).

## Project card (and grid)
- Page `543:1874`. Docs board `543:1875`; single component `537:47` (no variants).
- Purpose: "One project as a card — a real thumbnail slot, the name, one outcome sentence in the reader's words, never a tech-stack list. Cards rank two or three across; order is an argument: best first, not newest first."
- Anatomy (330x280): image frame 330x176 with placeholder text `project image` (bg-subtle, text-tertiary); body frame 330x104 with 16 padding holding `Project name one` (24 tall), one-line outcome (22 tall), year `2024` (18 tall). Grid in the specimen: two cards 330 wide, 24 gap, 12 radius, 1 px border-subtle.
- States: none (no hover/focus).
- Tokens: bg-surface, bg-subtle, border-subtle, text-primary, text-secondary, text-tertiary.
- Notes: "SPENDS · one format switch for the grid, not per card. Six cards before a 'more' link." Screenshot (`543:1875`) confirms two bordered cards with a grey image slot over a white text block. This is the component the portfolio template re-creates by hand.

## Experience entry
- Page `543:1877`. Docs board `543:1878`; single component `537:55` (no variants).
- Purpose: "A role as one honest row: title, place, span, and a single outcome line. The résumé is a file elsewhere; this is the story's spine."
- Anatomy (720x48): left cluster 325x48 → title row 194x24 with `Job title one` (92x24) and `· Company one` (94x22, 8 gap); outcome line 325x22 at y26. Right: date span `2022 – 2025` 71x18, right-aligned (x649). Rows stack at 64 px pitch (16 gap).
- States: none.
- Tokens: not sampled.
- Notes: "SPENDS · nothing. 3–5 rows; more belongs in the résumé."

## About block
- Page `543:1880`. Docs board `543:1881`; single component `537:60` (no variants).
- Purpose: "A portrait slot and first-person prose answering what the visitor is actually deciding: can I trust this person with my problem. One screen at most."
- Anatomy (736x96): portrait frame 96x96 with placeholder text `portrait`; prose text 620x78 at x116 (20 gap).
- States: none.
- Tokens: not sampled.
- Notes: "SPENDS · once, on the about page. The home page gets one sentence of it, not the block."

## Site footer
- Page `543:1883`. Docs board `543:1884`; single component `537:74` (no variants).
- Purpose: "The end of every page: the name again, the same few destinations, and the fine print. Nothing appears in a footer that the site has not already said."
- Anatomy (846x106, padding 24/20): left block 120x44 → `Full Name` (22) and `© 2026 · City, Country` (18). Right block at x671, 151x66 → two columns 83 apart: `SITE` eyebrow (14 tall) over `Link 1`, `Link 2`; `ELSEWHERE` eyebrow over `Link 3`, `Link 4` (links 20 tall, 26 pitch).
- States: none.
- Tokens: not sampled.
- Notes: "SPENDS · nothing. Once per page; it mirrors the header's destinations."

## Contact section
- Page `543:1886`. Docs board `543:1887`; single component `537:83` (no variants).
- Purpose: "One primary action and the quiet alternatives, at the end of the journey. Availability is stated as status, never as begging."
- Anatomy (294x106): `Heading` 77x28; one-line body 294x24 at y36; action row at y68, 206x38 → solid button frame 88x38 with `Button 1` label at (16,8), then `Link 1` and `Link 2` (39x22, 20 gap).
- States: none.
- Tokens: not sampled.
- Notes: "SPENDS · once, page end. Exactly one solid button on the page — this is where it lives." Gap: the button is a hand-drawn 38 px frame, not a Button instance; the Button component's medium size is 40. Build with Button Primary/Medium.

## Section head
- Page `540:1719`. Docs board `540:1720`; single component `537:1777` (no variants).
- Purpose: "Number and title in one grammar shared by all siblings, then a lede that states the section's point — not a teaser for it. Pinned grammar (19 Aug 2026): the number is a quiet address — text-tertiary, regular weight, a space, no dot; the title carries the weight. Same in code (course.css h2 .num) and here."
- Anatomy (846x102, padding 20): `03 Section title` 137x26; lede 806x24 at y58 (gap 12).
- States: none.
- Tokens: text-tertiary (number), text-secondary (lede), bg-surface.
- Notes: "SPENDS · 6–12 per page; siblings share a size and a grammar."

## Quote block
- Page `542:243`. Docs board `542:244`; single component `542:249` (no variants).
- Purpose: "A source quoted at length, attributed. A book worth building from is worth quoting in its own words rather than paraphrasing into fog."
- Anatomy (878x114, padding 20/16): quote text 838x56 opening with a curly quote; attribution `Author Name — Source Title` 156x18 at y80.
- States: none.
- Tokens: text-primary, text-tertiary, bg-surface, brand-solid (accent rule).
- Notes: "SPENDS · one format switch. If it needs trimming past one paragraph, cite and link instead."

## Timeline
- Page `542:111`. Docs board `542:112`; single component `542:133` (no variants).
- Purpose: "Stages on a rail, for sequences that are history or workflow rather than derivation. The portfolio's dot-and-rail pattern, generalised."
- Anatomy (344x58, padding 16/12): four stage groups 42x34, each a 10x10 `Ellipse` dot centred at x16 over a `Stage n` label (42x18, y16); three `line` connectors 48x10 between dots. Layer names are `edit`, `stage`, `commit`, `push` (git-flavoured leftovers); labels read Stage 1–4.
- States: screenshot (`542:112`) shows stages 1–2 with blue dots and 3–4 with grey dots, i.e. done vs pending, but this is not exposed as a property.
- Tokens: brand-solid (done dot), border-default (rail, pending dot), text-secondary (label).
- Notes: "SPENDS · one format switch. 3–6 stages; more is a chapter outline." Gap: stage count and done/pending are baked in, not properties.

## Button
- Page `6:14`. Component set `12:74` "Button" (916x1020); spec board `66:17` "Button — specification"; example board `34:104` "With icons".
- Purpose (spec intro): "Every value below is a token. Nothing about this component is a fixed number, so changing a token changes all 72 variants at once."
- Variants: **Style** = Primary, Secondary, Ghost, Danger; **Size** = Small, Medium, Large; **State** = Default, Hover, Focus, Pressed, Loading, Disabled → 4 x 3 x 6 = **72 variants**. Plus a boolean **Show icon** (spec: "Turn on 'Show icon' in the right-hand panel, then swap which icon it uses"); the `Icon` instance is present but hidden by default.
- Anatomy (master `12:8`, Medium 76x40): `Icon` instance 20x20 at (16,10) hidden; `Label` text 44x20 at (16,10). Loading (`159:7`) adds a `Spinner` instance 20x20 absolutely centred. Spec parts: 1 container (height size/control/*, radius/md, fill brand/solid) · 2 padding (spacing/sm|md|lg by size) · 3 icon slot (size/icon/sm|md, off by default) · 4 gap (spacing/xs) · 5 label (Label/Medium|Large, text/on-solid).
- Sizing: Small 32 tall, padding-x 12, Label/Medium 14, icon 16 (68x32 with "Button"); Medium 40 / 16 / 14 / 20 (76x40); Large 48 / 24 / Label/Large 16 / 20 (98x48).
- States (spec table): Default "brand/solid, bg/surface, transparent or danger/solid by style"; Hover ON_HOVER 100ms, "fill moves one step darker: brand/solid-hover, bg/hover, brand/subtle, danger/solid-hover"; Focus "ON_FOCUS has no Figma trigger — the variant exists, set it by hand. 2px border/focus stroke, outside"; Pressed ON_PRESS 100ms, "brand/solid-active, bg/active, brand/subtle-hover, danger/solid-active"; Loading "label keeps its space but loses its ink; Icon/loader sits absolutely centred and turns once per cycle/spin. Width is identical to Default — verified on all 12 pairs"; Disabled "fill bg/disabled, label text/disabled, no border".
- Tokens bound: brand-solid/-hover/-active/-subtle/-subtle-hover/-text, danger-solid/-hover/-active, bg-surface/-hover/-active/-disabled, text-on-solid/-primary/-disabled, border-control/-subtle/-focus, size-control-sm/md/lg, size-border-thin, spacing-xs/sm/md/lg, radius-md/lg, Label/Medium, Label/Large.
- Accessibility (spec): "Primary 5.17:1, hover 7.25:1, pressed 9.71:1, Danger 5.55:1. All above the 4.5:1 floor, measured in both themes." Target size: Medium/Large clear 24 px; "Small at 32 is fine on pointer devices but pair it with generous spacing on touch." Focus: "In code it is outline 2px border/focus with a 2px offset." Keyboard: "Use a real button element." Icon only: "add aria-label." Disabled: "never rely on colour alone."
- Do: one Primary per view; Danger for destructive, kept away from primary; labels verb + noun; Ghost for tertiary (Cancel). Don't: two Primaries side by side; Danger for reversible; "Click here, OK or Submit"; detaching to change a colour.
- Screenshot (`12:74`): a 12-row x 6-column grid — rows are Style x Size, columns Default, Hover, Focus (blue ring), Pressed, Loading (spinner), Disabled (grey). Secondary is white with a 1 px control border; Ghost is text-only with a subtle tint on hover.

## Badge
- Page `6:17`. Component set `17:26` "Badge" (360x376); spec board `69:2` "Badge — specification".
- Purpose (spec intro): "A badge reports state. It is not a button and never carries an action — if it can be clicked, it is the wrong component."
- Variants: **Tone** = Neutral, Brand, Success, Warning, Danger, Info; **Variant** = Solid, Subtle → **12 variants**. All 52x20 with the placeholder label.
- Anatomy (master `17:2`): `Label` text 36x16 at (8,2). Spec: container "padding spacing/3xs vertical and spacing/xs horizontal, radius/full"; label "Label/Small, letter-spacing 0.2"; fill and border "set by Tone and Variant".
- Tones (meaning → typical labels): Neutral "No judgement. A category or plain fact." → Draft, Archived, Viewer; Brand "Tied to the product or plan, not to health." → Pro, Beta, New; Success "Something finished or is healthy." → Active, Paid, Verified; Warning "Attention needed, but nothing is broken yet." → Trial ends soon, Pending; Danger "Something failed or is blocked." → Payment failed, Suspended; Info "Neutral context worth noticing." → Scheduled, Syncing.
- Solid vs Subtle: Subtle is "The default. Use in tables and lists where many badges appear together", label in "the tone's own text colour"; Solid is "One badge that must be noticed, such as a plan tier in a header", label "text/on-solid, or text/on-solid-inverse on Success and Warning".
- States: none — "Not interactive: No focus state, no hit area rules. If it needs to be clickable, use a Button."
- Tokens bound: bg-inverse + text-inverse (Neutral solid), neutral-subtle, brand-solid/-text/-subtle, success-solid/-text/-subtle, warning-solid/-text/-subtle, danger-solid/-text/-subtle, info-solid/-text/-subtle, text-on-solid, text-secondary, spacing-3xs, spacing-xs, radius-full, size-border-thin, Label/Small.
- Accessibility: "Success and Warning solids are light by nature. White on them reaches only 3.4:1 and 3.7:1, so those two variants use text/on-solid-inverse instead"; "Every tone's text on its own subtle fill measures between 6.5:1 and 8.9:1 across both themes"; never colour alone.
- Do/don't: state as a word, Subtle in dense lists, one or two words; no clickable badge, not Solid everywhere, not colour-only meaning.
- Screenshot (`17:26`): six rows of pill pairs — solid navy/blue/green/brown/red/blue on the left, matching tinted subtle pills with coloured text on the right. Brand and Info resolve to identical colours in Light.

## Tag
- Page `546:76`. Docs board `546:77`; single component `546:92` (no variants).
- Purpose: "The interactive badge: a label the user applied and can remove. Filters, selected options, topics. The Badge states; the Tag is owned."
- Anatomy (84x26): `tag label` text 52x18 at (10,4) → padding 10/4; `x-align` frame 8x18 at x68 (gap 6) holding `Icon/close` 8x8. Pill radius.
- States: none — no hover, focus, selected or disabled variants although the close target is interactive.
- Tokens: bg-subtle, text-secondary (label), text-tertiary (close icon).
- Notes: "USAGE · groups wrap; removing the last tag returns the empty state, designed." Gaps: no empty state is drawn on the page; the 8 px close icon has no enlarged hit area. Screenshot: small grey pill reading "tag label ×".

## Card
- Page `6:19`. Component set `18:29` "Card" (800x220); spec board `71:2` "Card — specification".
- Purpose (spec intro): "A surface that groups related content. Width is fixed and height hugs whatever is inside, so a card never dictates the height of a row."
- Variants: **Elevation** = Flat, Raised → 2 variants, both 320x154.
- Anatomy (master `18:23`): `Title` text 272x26 at (24,24); `Body` text 272x72 at (24,58). Spec: container "fill bg/surface, radius/lg, padding spacing/lg on all four sides"; gap "spacing/xs between title and body"; Title "Heading/H4 in text/primary — exposed as a text property"; Body "Body/Medium in text/secondary — exposed as a text property"; Edge "Flat uses a border/subtle 1px edge; Raised uses Shadow/md and no border".
- Elevation: Flat "Cards sit in a grid or list. Shadows on every tile turn into visual noise."; Raised "The card floats above the page: a single summary panel, a popover, a dragged item."
- States: none (no hover/focus/selected).
- Tokens bound: bg-surface, border-subtle, text-primary, text-secondary, spacing-xs, spacing-lg, radius-lg, size-border-thin, Heading/H4, Body/Medium, Shadow/md.
- Known limitation (quoted): "No content slot yet — Card exposes a title and a body string and nothing else, so it cannot hold buttons, toggles or a form. The Settings template needed exactly that, and had to use a token-bound frame instead of a Card instance. If panels like that become common, rework Card to take a slot rather than working around it each time." The portfolio template hit the same wall.
- Accessibility: not a landmark, use a real heading; clickable cards wrap the title in the link and stretch its hit area with a pseudo-element; no nested interactives; "text/primary on bg/surface is 17.85:1 in Light and 17.06:1 in Dark."
- Do/don't: Flat in grids, Raised for one floating surface; one idea per card; height hugs content; no card in a card; no shadow on every tile; not clickable plus buttons inside.
- Screenshot (`18:29`): two white 320-wide cards, "Card title" over three lines of body; left has a thin border, right has a soft shadow and no border.

## Callout
- Page `542:1966`. Docs board `542:1967`; component set `537:136` "Callout" (894x448); master `537:114`.
- Purpose: "One tone per callout, chosen by what the reader must do: Info explains, Success confirms, Warning flags the surprise, Danger stops a mistake. Shown here as the palette — a real page picks one."
- Variants: property **tone** = `info`, `success`, `warning`, `danger` — 4 variants, each 846x82.
- Anatomy: each variant is a thin wrapper around one `Alert` instance (a separate library component not among the documented pages). Inside: `Icon` 20x20 at (16,16); `Content` frame at (48,16) 782x50 with `Title` (24 tall, Label/Large) and `Message` (22 tall, Body/Small, gap 4). Padding 16, icon-to-content gap 12, radius 8, 1 px tone border.
- States: none.
- Tokens bound: info/success/warning/danger -text, -subtle, -border; text-secondary; spacing-sm, spacing-md, radius-md, size-border-thin; Label/Large, Body/Small.
- Notes: "SPENDS · one of the 2 callouts a section is allowed, never adjacent to another." Screenshot (`537:136`): four full-width tinted rows (blue, green, yellow, red) each with an outline icon, a coloured "Heads up" title and a grey one-line message. Gap: Alert's own properties (dismiss, action) are not visible from this page.

## Tooltip
- Page `546:2`. Docs board `546:3`; single component `546:15` (no variants).
- Purpose: "A short label on hover or focus, for UI that needs a word of explanation — never for content (content uses the term preview). One line; if it wraps twice, the control needs a better label."
- Anatomy (117x28): text `Copy to clipboard` 97x16 at (10,6) → padding 10/6, small radius. No caret/arrow.
- States: none; behaviour note only.
- Tokens: bg-inverse `#0f172a`, text-inverse.
- Notes: "USAGE · one line, appears on hover and focus both, never traps the pointer." Gaps: no placement variants (top/bottom/left/right) and no arrow. Screenshot: dark rounded pill with white 12 px text.

## Back link
- Page `552:79`. Docs board `552:80`; single component `552:94` (no variants).
- Purpose: "The way out, named: an arrow and the destination. 'Back' alone promises nothing; 'Back to projects' is a place."
- Anatomy (144x22): `Icon/arrow-right` 14x14 (rotated to point left; metadata places it at x14 y18 because of the rotation) and text `Back to destination` 124x22 at x20 (gap 6).
- States: none (no hover/focus/visited).
- Tokens: text-link (`#2563eb`), text-primary.
- Notes: "USAGE · top left, above the title. Names the parent, never just 'back'." Gap: the library has no dedicated arrow-left icon; the build should just use a left arrow. Screenshot: "← Back to destination" in link blue.

## Divider with label
- Page `552:63`. Docs board `552:64`; single component `552:78` (no variants).
- Purpose: "The 'or' between two ways to do one thing. A word in the middle of a rule, nothing more."
- Anatomy (276x18): two `Rectangle` rules 120x1 at y8.5; text `or` 12x18 at x132 (12 gap each side).
- States: none.
- Tokens: border-default (rules), text-tertiary (word).
- Notes: "USAGE · auth forms and choice points. If the word is longer than three letters, reconsider." Gap: fixed 276 width with fixed 120 rules; the build should let the rules flex. Screenshot: two thin grey rules with a small grey "or" between them.

---

## Cross-cutting gaps noticed while reading

- No documented page for **Nav link**, **Chevron**, **Alert** (wrapped by Callout) or the icon set (Icon/moon, Icon/sun, Icon/close, Icon/arrow-right, Spinner), all of which are referenced as instances.
- Only Button carries hover/focus/pressed/disabled variants. Tag, Back link, Theme toggle, Header nav links and Project card are interactive in intent but have a single drawn state; the Skip link is drawn focused only.
- The portfolio section components (Hero through Contact section, Section head, Quote block, Timeline) are single fixed-size masters with placeholder text, not variant sets; treat their sizes as reference layouts, not constraints.
- Contact section and Hero both describe a primary action but neither uses the Button component; Hero has no action at all.
- Brand and Info tokens resolve to the same colours in Light mode, so Badge Brand and Badge Info are visually identical.
