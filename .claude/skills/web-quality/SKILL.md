---
name: web-quality
description: Accessibility, performance, privacy and security standards for anandfrancis.com. Use whenever creating or changing pages, components, styles, fonts, images, motion, the theme switch, the resume PDF, HTTP headers or deploy configuration, and when reviewing a PR that touches any of those.
---

# Web quality standard

These are pass or fail conditions, not aspirations. Where a check can be a script, it is a
script in CI and it is allowed to fail the build (the design system's own principle:
verified, not assumed). Human judgement is reserved for what a script cannot see.

## Budgets (measured on the production build, mobile and desktop)

- Lighthouse: Performance 95 or higher, Accessibility 100, Best Practices 100, SEO 100.
- Core Web Vitals on a simulated mid-range phone over 4G: LCP under 2.0 s, CLS 0,
  INP under 200 ms.
- JavaScript shipped to the home page: under 30 KB compressed. The site is static; scripts
  are limited to the theme bootstrap, the theme toggle, the scroll-reveal observer and the
  experience accordion.
- No third-party requests in version one. Fonts are self-hosted. No analytics, no CDN scripts.
- Zero console errors and zero mixed-content warnings.

## Accessibility (WCAG 2.2 AA, plus the items the design system calls out)

- One `h1` per page. Sections use `h2`. Entries inside sections (roles, degrees,
  certificates) are `h3` even when they wear the Heading/H4 style. Never derive the tag from
  the style name. The outline runs H1 > H2 > H3 with no skips.
- Landmarks: `header`, `nav` with an accessible name, `main`, `footer`. A skip-to-content
  link is the first focusable element and becomes visible on focus.
- Focus is always visible: 2 px outline in `--color-border-focus`, offset 2 px. Never remove
  an outline without an equal replacement. Test every interactive element in both themes.
- The sticky header must not obscure a focused or targeted element (WCAG 2.4.11). Every
  section with an id sets `scroll-margin-top` to at least the header height (80 px).
- Targets are at least 24 by 24 CSS px; nav links and buttons 40 or 48 px tall as designed.
- Text contrast 4.5:1; large text and control boundaries 3:1. Use only the token pairings the
  design system certifies. A contrast script runs in CI over every text and border pairing
  the site uses, in both themes, and fails on any miss.
- Colour never carries meaning alone. Badges carry a word; the theme toggle has a label and
  an icon; the expanded state of an experience entry is exposed with `aria-expanded`.
- Link purpose is clear from the link text alone (no "Read more"). External links are
  marked and open in the same tab.
- Reflow: no horizontal scrolling at 320 px wide. Text scales to 200% without loss. The
  layout survives forced text spacing (line-height 1.5, paragraph spacing 2 em,
  letter-spacing 0.12 em, word-spacing 0.16 em).
- Icons are inline SVG with `aria-hidden="true"` when decorative; icon-only controls carry
  an accessible name in text.
- The accordion is a real `button` with `aria-expanded` and `aria-controls`; collapsed
  content is hidden from the accessibility tree and from tab order.
- The resume PDF is generated tagged, with the same heading order, and is linked with its
  format and size in the link text.
- Automated checks in CI: axe-core over the built pages in both themes, HTML validation,
  and a Playwright keyboard walk that tabs through every interactive element and asserts a
  visible focus ring.

## Motion

- Motion in version one is limited to: hover and focus feedback, a smooth theme switch, and
  a single subtle reveal per section as it enters the viewport. Nothing else moves.
- Reveals: opacity 0 to 1 and translateY of at most 16 px, `--duration-base` with
  `--ease-decelerate`, triggered once by an IntersectionObserver, never re-run on scroll-up.
  Content is visible without JavaScript: the hidden state is applied by a class the script
  adds only after it has loaded.
- Hover and focus: `--duration-fast` with `--ease-standard`. Background steps one level;
  never a size change.
- Theme switch: crossfade of colour only, `--duration-base`. No transition on first paint.
- Reduced motion, both layers, exactly as the design system ships them: the token layer sets
  every `--duration-*` to 0 ms under `prefers-reduced-motion: reduce`, and a catch-all sets
  animation and transition durations to 0.01 ms and `scroll-behavior: auto`. Reveals become
  opacity-only at zero duration; state changes stay visible.
- Nothing auto-plays, loops or moves for more than five seconds.

## Performance mechanics

- Fonts: IBM Plex Sans 400, 500, 600, 700 and IBM Plex Mono 400, self-hosted WOFF2, Latin
  subset, `font-display: swap`, the two most-used files preloaded, and a metric-matched
  fallback (`size-adjust`, `ascent-override`) so the swap causes no layout shift.
- Images: AVIF or WebP with explicit `width` and `height`, responsive `srcset`, lazy below
  the fold, never text baked into an image. The hero has no image; the LCP element is the
  headline.
- CSS: one stylesheet, tokens first, no runtime CSS-in-JS. Unused CSS is pruned at build.
- HTML is prerendered at build time. No client-side routing.
- Cache: static assets fingerprinted and served immutable for a year; HTML served with a
  short max-age and revalidation.

## Privacy and security

- Headers set on Cloudflare: a strict Content-Security-Policy (self only, plus a hash for
  the theme bootstrap inline script), `Strict-Transport-Security` with preload,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` denying camera, microphone and geolocation, and
  `X-Frame-Options: DENY`. Target: an A grade or better on securityheaders.com.
- The email address is a plain `mailto:` link with the address visible; no contact form, no
  server-side handling, no obfuscation that breaks copy and paste.
- Theme preference is the only thing stored client-side, in `localStorage`, and it is not a
  cookie. No tracking of any kind in version one.
- Dependencies are pinned with a lockfile; an audit at high severity fails CI.

## Definition of done for any UI change

1. Build succeeds and the CI checks above pass.
2. Screenshots in both themes at 390, 768 and 1440 px are attached to the PR and compared
   against the Figma template or the approved spec.
3. Keyboard walk performed and described in the PR: what was tabbed, what was seen.
4. Lighthouse scores pasted into the PR for the affected page.
