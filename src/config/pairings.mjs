// Every foreground and background token pairing the site uses, with the WCAG floor it must
// clear in both themes. scripts/check-contrast.mjs reads this and the token sheet and fails
// the build on any miss or duplicate. Add a pairing here before using it in a stylesheet.
//
// min 4.5: normal text. min 3: large text (24px regular, 18.66px bold) and the boundary of a
// control or focus ring against its surroundings. Not listed by design: disabled text (exempt
// by the design system's own rule), border-subtle dividers (decorative, no ratio owed), and the
// focus ring against the primary button fill, because the 2px outline-offset shows the page
// through the gap and the ring is judged against the page, as the Interactions page states.

const text = (fg, bg, note) => ({ fg, bg, min: 4.5, note });
const boundary = (fg, bg, note) => ({ fg, bg, min: 3, note });

export const pairings = [
  // Neutral text on surfaces
  text("--color-text-primary", "--color-bg-canvas", "headings and body on the page"),
  text("--color-text-primary", "--color-bg-surface", "headings and body on cards and bands"),
  text("--color-text-primary", "--color-bg-subtle", "text on the footer band"),
  text("--color-text-secondary", "--color-bg-canvas", "body copy"),
  text("--color-text-secondary", "--color-bg-surface", "body copy on bands"),
  text(
    "--color-text-secondary",
    "--color-bg-subtle",
    "footer copyright (tertiary on subtle is 4.34:1 in light, so the footer uses secondary)",
  ),
  text("--color-text-secondary", "--color-neutral-subtle", "neutral badge label"),
  text("--color-text-tertiary", "--color-bg-canvas", "dates and captions"),
  text("--color-text-tertiary", "--color-bg-surface", "dates and captions on bands"),

  // Coloured text
  text("--color-brand-text", "--color-bg-canvas", "eyebrows and links"),
  text("--color-brand-text", "--color-bg-surface", "eyebrows and links on bands"),
  text("--color-brand-text", "--color-bg-subtle", "footer links"),
  text("--color-brand-text", "--color-brand-subtle", "brand badge label, ghost button hover"),
  text("--color-text-link", "--color-bg-canvas", "inline links"),
  text("--color-text-link", "--color-bg-surface", "inline links on bands"),
  text("--color-code-ink", "--color-bg-surface", "inline code"),
  text("--color-success-text", "--color-success-subtle", "hero badge"),
  text("--color-danger-text", "--color-danger-subtle", "error messages"),
  text("--color-warning-text", "--color-warning-subtle", "warning callout"),
  text("--color-info-text", "--color-info-subtle", "info callout"),

  // Labels on solids. The Badge page says success and warning solids take the near-black label,
  // but with the v4.1.0 token values those solids are dark: near-black measures 3.1:1 and 2.8:1
  // on them while white clears 4.5:1, so the site uses text-on-solid on every solid.
  text("--color-text-on-solid", "--color-brand-solid", "primary button"),
  text("--color-text-on-solid", "--color-brand-solid-hover", "primary button hover"),
  text("--color-text-on-solid", "--color-brand-solid-active", "primary button pressed"),
  text("--color-text-on-solid", "--color-danger-solid", "danger badge or button"),
  text("--color-text-on-solid", "--color-success-solid", "success solid badge"),
  text("--color-text-on-solid", "--color-warning-solid", "warning solid badge"),
  text("--color-text-inverse", "--color-bg-inverse", "tooltip"),
  text("--color-terminal-text", "--color-terminal-bg", "terminal block"),

  // Control boundaries and the focus ring against every band it can sit on
  boundary("--color-border-control", "--color-bg-surface", "secondary button edge"),
  boundary("--color-border-control", "--color-bg-canvas", "secondary button edge on the page"),
  boundary("--color-border-focus", "--color-bg-canvas", "focus ring on the page"),
  boundary("--color-border-focus", "--color-bg-surface", "focus ring on bands"),
  boundary("--color-border-focus", "--color-bg-subtle", "focus ring on the footer band"),
];
