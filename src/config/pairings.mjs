// Every foreground and background token pairing the site uses, with the WCAG floor it must
// clear in both themes. scripts/check-contrast.mjs reads this and the token sheet and fails
// the build on any miss. Add a pairing here before using it in a stylesheet.
//
// min 4.5: normal text. min 3: large text (24px regular, 18.66px bold) and the boundary of a
// control against its surroundings. Disabled text is exempt by the design system's own rule
// and is not listed.

export const pairings = [
  // Neutral text on surfaces
  {
    fg: "--color-text-primary",
    bg: "--color-bg-canvas",
    min: 4.5,
    note: "headings and body on the page",
  },
  {
    fg: "--color-text-primary",
    bg: "--color-bg-surface",
    min: 4.5,
    note: "headings and body on cards and bands",
  },
  { fg: "--color-text-primary", bg: "--color-bg-subtle", min: 4.5, note: "footer text" },
  { fg: "--color-text-secondary", bg: "--color-bg-canvas", min: 4.5, note: "body copy" },
  { fg: "--color-text-secondary", bg: "--color-bg-surface", min: 4.5, note: "body copy on bands" },
  { fg: "--color-text-secondary", bg: "--color-bg-subtle", min: 4.5, note: "badge neutral label" },
  {
    fg: "--color-text-secondary",
    bg: "--color-neutral-subtle",
    min: 4.5,
    note: "neutral badge label",
  },
  { fg: "--color-text-tertiary", bg: "--color-bg-canvas", min: 4.5, note: "dates and captions" },
  {
    fg: "--color-text-tertiary",
    bg: "--color-bg-surface",
    min: 4.5,
    note: "dates and captions on bands",
  },
  {
    fg: "--color-text-secondary",
    bg: "--color-bg-subtle",
    min: 4.5,
    note: "footer copyright (tertiary on subtle is 4.34:1 in light, so the footer uses secondary)",
  },

  // Coloured text
  { fg: "--color-brand-text", bg: "--color-bg-canvas", min: 4.5, note: "eyebrows and links" },
  {
    fg: "--color-brand-text",
    bg: "--color-bg-surface",
    min: 4.5,
    note: "eyebrows and links on bands",
  },
  { fg: "--color-brand-text", bg: "--color-bg-subtle", min: 4.5, note: "footer links" },
  { fg: "--color-text-link", bg: "--color-bg-canvas", min: 4.5, note: "inline links" },
  { fg: "--color-text-link", bg: "--color-bg-surface", min: 4.5, note: "inline links on bands" },
  { fg: "--color-code-ink", bg: "--color-bg-surface", min: 4.5, note: "inline code" },
  { fg: "--color-success-text", bg: "--color-success-subtle", min: 4.5, note: "hero badge" },
  { fg: "--color-danger-text", bg: "--color-danger-subtle", min: 4.5, note: "error messages" },
  { fg: "--color-warning-text", bg: "--color-warning-subtle", min: 4.5, note: "warning callout" },
  { fg: "--color-info-text", bg: "--color-info-subtle", min: 4.5, note: "info callout" },

  // Labels on solids
  { fg: "--color-text-on-solid", bg: "--color-brand-solid", min: 4.5, note: "primary button" },
  {
    fg: "--color-text-on-solid",
    bg: "--color-brand-solid-hover",
    min: 4.5,
    note: "primary button hover",
  },
  {
    fg: "--color-text-on-solid",
    bg: "--color-brand-solid-active",
    min: 4.5,
    note: "primary button pressed",
  },
  { fg: "--color-text-inverse", bg: "--color-bg-inverse", min: 4.5, note: "tooltip" },
  { fg: "--color-terminal-text", bg: "--color-terminal-bg", min: 4.5, note: "terminal block" },

  // Control boundaries and focus. The ring on the primary button is not listed: the 2px
  // outline-offset shows the page through the gap, so the ring is judged against the page,
  // exactly as the design system's Interactions page describes.
  { fg: "--color-border-control", bg: "--color-bg-surface", min: 3, note: "secondary button edge" },
  {
    fg: "--color-border-control",
    bg: "--color-bg-canvas",
    min: 3,
    note: "secondary button edge on the page",
  },
  { fg: "--color-border-focus", bg: "--color-bg-canvas", min: 3, note: "focus ring on the page" },
  { fg: "--color-border-focus", bg: "--color-bg-surface", min: 3, note: "focus ring on bands" },
];
