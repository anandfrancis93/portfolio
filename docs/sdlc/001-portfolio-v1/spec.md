# Spec: anandfrancis.com, version one

Status: accepted by the product owner on 2 September 2026. All ten concerns in section 12
were resolved the same day.
Derived from: `intent.md` (accepted 2 September 2026).
Constraints applied: the `acme-design-system`, `portfolio-voice` and `web-quality` skills in
`.claude/skills/`, and the Figma template Template - Portfolio (node 588:2) as the layout
starting point to adapt.
Companion documents: `docs/design-system/figma-pages.md` (page ids),
`docs/design-system/components.md` (component inventory).

Areas of concern are collected in section 12 with a recommendation each. All ten were
decided by the product owner on 2 September 2026 and sections 1 to 11 reflect the decisions.

---

## 1. What version one delivers

A single-page site at `https://anandfrancis.com` with a generated résumé PDF, in light and
dark themes, served as static assets from a Cloudflare Worker. Nine sections in this
order: Header, Hero, Experience, Projects (placeholder), About (with Education and
Certifications), Skills, Recommendations, Contact, Footer. Plus a 404 page.

Every word on the page is the approved copy carried in `intent.md` and the template,
corrected only where section 12 says so. The site and the PDF render from one content
file, so they cannot drift.

## 2. Routes

| Route | What it serves |
| --- | --- |
| `/` | The home page, prerendered HTML |
| `/resume` | The résumé PDF, served inline (`application/pdf`); also the QR code target |
| `/anand-francis-resume.pdf` | The same file with a stable name for download links |
| `/404` | Not-found page in the site's voice, with a link home and the email |

No other routes in version one. Section anchors on the home page: `#experience`,
`#projects`, `#about`, `#skills`, `#recommendations`, `#contact`. The header links to the
first four, matching the template's four-item nav (Miller's law, from the design system's
UX page); Skills and Recommendations are reachable by scrolling and by the skip link's
landmark order.

## 3. Page structure and behaviour

Section bands alternate as in the template: Hero on canvas, Experience on surface,
Projects on canvas, About on surface, Skills on canvas, Recommendations on surface,
Contact on canvas, Footer on subtle. Each section pads 64 vertically on desktop, centres
an inner column of `--container-xl` (1200px), and stacks eyebrow, heading and lede with
8px gaps, then 40px to the body.

### 3.1 Header

- Sticky, `--size-bar-header` (80px) tall, surface background, 1px `border-subtle` bottom.
- Left: wordmark "ANAND FRANCIS", Label/Large medium with 0.08em tracking, `text-primary`,
  links to `#top`. On mobile (under 768px) the header is 64px tall and the wordmark is
  "AF" inside a 44px-tall hit area.
- Right, desktop: four nav links Experience, Projects, About, Contact in Body/Small,
  `text-secondary`, 32px tall with 8px horizontal padding and `radius-sm`; the link for
  the section currently in view is `brand-text` (scroll-spy, updated with an
  IntersectionObserver; no JavaScript means no highlight, which is acceptable). Then the
  theme toggle.
- Right, mobile: theme toggle (44px target) and a menu button (Icon/menu at 20px in a
  44px target, `aria-expanded`, `aria-controls`) that opens the mobile menu.
- Mobile menu (from template frame 589:1746): a full-screen surface panel. Top bar mirrors
  the header with "AF" and a close button (Icon/close). Links Experience, Projects, About,
  Contact in Heading/H3 style, `text-primary`, each 16px vertical padding with a
  `border-subtle` divider. Below: a full-width Primary Large button labelled with the email
  address, a `mailto:` link. Focus is trapped while open, Escape closes, the underlying
  page is inert, and the first link receives focus on open.
- A skip-to-content link is the first focusable element on the page and becomes visible on
  focus, styled per the design system's Skip-to-content component (Label/Medium, surface,
  2px focus ring).

### 3.2 Hero

- Badge, Success Subtle, "Open to internships". Not interactive.
- `h1` in Display style (48/56 bold, letter-spacing -1.5px), max-width 880px:
  "Eleven years keeping systems running. Now I'm learning to secure them."
  On mobile the H1 style (36/44) is used instead.
- Paragraph, Body/Large, `text-secondary`, max-width `--measure-prose` (560px):
  "Eleven years in IT and technical support — AT&T, American Express, Google, Dell, and
  since 2023 Brigham Young University – Idaho. Security+ certified, finishing a B.S. in
  Cybersecurity in July 2028. Looking for a security internship now, and a security role
  after graduation."
- Actions, 12px gap: Button Primary Large "Get in touch" linking to `#contact`, and
  Button Secondary Large "See my experience" linking to `#experience` (C1, accepted).
  The template's "See my work" is not used in version one.
- No image. The heading is the Largest Contentful Paint element.

### 3.3 Experience

- Eyebrow EXPERIENCE (Label/Small caps, `brand-text`). `h2` "Eight roles across six
  organizations, since 2015".
- Eight entries, newest first, each a row with 32px vertical padding and a `border-subtle`
  bottom edge (none on the last):
  - Date span, 160px column, Label/Medium, `text-tertiary`: "2026 — Now", "2025 — 2026",
    "2023 — 2025", "2019 — 2023", "2017 — 2019", "2017", "2016 — 2017", "2015 — 2016".
  - Role: `h3` wearing Heading/H4 style, `text-primary`; organization in Body/Small,
    `text-secondary`; the title row also holds a 20px chevron.
  - Bullets: Body/Large, `text-secondary`, max-width 560px, with a `text-tertiary` bullet
    glyph and 8px between items. Content is the eight roles and their bullets exactly as
    confirmed (transcribed in section 9).
- Behaviour: each entry is a disclosure. The whole title row is a real `button` with
  `aria-expanded` and `aria-controls`; the chevron points down when collapsed and up when
  expanded. The first entry is expanded on load; the others are collapsed. Collapsed
  bullets are removed from the accessibility tree and tab order. Without JavaScript all
  entries render expanded. Open uses `--duration-base` with `--ease-decelerate`, close
  with `--ease-accelerate`; the chevron rotation is dropped under reduced motion.
- Mobile: the date sits above the role title; the chevron stays at the row's right edge.

### 3.4 Projects (placeholder)

- Eyebrow PROJECTS. `h2` "What I built, and what went wrong". Lede, Body/Large: "It has a
  write-up. The interesting part is rarely the result — it is the bit where the first three
  attempts did not work."
- Body: a designed empty state, not a card, per the intent decision and the design
  system's rule that an empty state says what is empty, why, and the next action. Copy
  (C2, accepted): "The write-ups are on their way. The first is the design system
  this site is built on, and how the first three attempts went wrong. Until it lands, the
  experience above is the record." Followed by a Ghost button "Read my experience"
  linking to `#experience`.
- The empty state sits in a surface panel with `border-subtle`, `radius-lg` and 32px
  padding, the same shell the future project card will use, so the section does not
  change shape when the first card arrives.

### 3.5 About

- Eyebrow ABOUT. `h2` "Support is where you learn how systems actually fail", max-width 632px.
- Two columns with a 64px gap on desktop: prose 640px (paragraphs at 560px), side column
  fills the rest. On tablet and mobile the side column stacks below the prose.
- Prose, three paragraphs in Body/Large, `text-secondary`, 16px apart, exactly as in the
  template (transcribed in section 9).
- Side column, 32px between groups:
  - EDUCATION (Label/Small caps, `text-primary`): "B.S. Cybersecurity" as `h3` in H4
    style; "Brigham Young University – Idaho · expected July 2028" in Body/Small,
    `text-tertiary`.
  - CERTIFICATIONS: three entries, 16px apart, same treatment:
    "CompTIA Security+ (ce)" with "CompTIA · December 2025 – December 2028";
    "Gemini Certified University Student" with "Google for Education · October 2025 –
    October 2028"; "CompTIA IT Fundamentals+ (ITF+)" with "CompTIA · July 2025".
    The template shows only the first two and names the second "Gemini Certified
    Student"; the spec uses the LinkedIn names and adds ITF+ per the intent (C6, accepted).
- No portrait in version one (C8, accepted).

### 3.6 Skills

- Eyebrow SKILLS. `h2` "What I can do on day one". Lede "Honest levels. Anything I have
  only read about is not on this list."
- A definition list of three rows, each with 16px vertical padding and a `border-subtle`
  bottom edge, 824px wide on desktop: a 160px label in Label/Small caps, `text-primary`,
  then the items in Body/Large, `text-secondary`, separated by " · ":
  - ENDPOINT & IDENTITY: Active Directory · SCCM · Jamf Pro MDM · ClearPass 802.1X ·
    PXE imaging · Windows · macOS
  - AI TOOLING / CLI: Claude Code · Codex · Antigravity · Grok Build · OpenRouter ·
    Figma MCP · Cloudflare MCP · Git & GitHub
  - PLATFORMS: Canvas LMS · Google Ads · Merchant Center · Google Analytics
- Mobile: label above items. Content confirmed as written (C7); no Security row in version one.

### 3.7 Recommendations

- Eyebrow RECOMMENDATIONS. `h2` "From people I have worked with".
- One quote card: canvas background on the surface band, `border-subtle`, `radius-lg`,
  32px padding. Quote in Body/XLarge (24/36), `text-primary`, max-width 840px, wrapped in
  curly quotes. Attribution below a `border-subtle` top rule with 24px padding: name in
  Label/Medium `text-primary`, title in Body/Small `text-tertiary`.
- Text is the LinkedIn recommendation verbatim, per the intent decision to quote in full
  (C5, confirmed; the template carries an edited version that is not used):
  "I've supervised Francis in our IT Tier 2 team and have been impressed by his blend of
  technical depth, quick learning, and open-minded approach. He resolves incidents calmly
  and efficiently, absorbs new tools at speed, uplifts colleagues, and users with his
  positive attitude. Any organization would benefit from Francis's reliable,
  forward-thinking professionalism."
  Attribution: "Manoel Galvao", "Technology Manager, BYU–Idaho IT".
- Markup: `blockquote` with `cite` in a `figure` and `figcaption`.

### 3.8 Contact

- Eyebrow CONTACT. `h2` "Say hello". Body/Large, 560px: "If you have a security
  internship, or you want to talk about AI adoption inside a university, my inbox is open.
  I am in Rexburg, Idaho and open to remote work or relocation."
- Primary Large button whose label is the address, "anand.francis93@gmail.com", as a
  `mailto:` link. This is the page's action; the hero buttons lead here (concern C1).
- Right, desktop: a 148px QR code (SVG generated at build from the résumé URL) with the
  caption "Résumé" in Body/Small `text-secondary` and "anandfrancis.com/resume" in
  Caption `text-tertiary`. The QR is wrapped in a link to `/resume` with the accessible
  name "Résumé (PDF)". On mobile it sits below the button, centred.

### 3.9 Footer

- `--size-bar-footer` (70px) tall on desktop, subtle background, `border-subtle` top.
  Text in Body/Small.
- Left, `text-tertiary`: "© 2026 Anand Francis · Designed in Figma", the year computed at
  build.
- Right, `brand-text` links, 24px apart: GitHub (github.com/anandfrancis93), LinkedIn
  (linkedin.com/in/anandfrancis93), Résumé (`/resume`). The template's fourth link, "CV",
  has no target and is dropped (C4, accepted).
- Mobile: two rows, 130px tall in the template; links wrap.

### 3.10 404 page

Same header and footer. `h1` "Nothing at this address", one line in the voice ("The page
you wanted is not here. The home page has everything I have published."), a Primary
button "Go to the home page" and the email link.

## 4. Responsive behaviour

Three tiers from the design system's Layouts page. The inner column is
`min(var(--container-xl), 100% - 2 * margin)` with margins 64px on desktop, 32px on tablet,
16px on mobile. Template frames were drawn at 1440, 768 and 390; every width between must
be checked in the browser before merge, with screenshots at 320, 390, 600, 768, 1024,
1280 and 1440 attached to the PR.

| Tier | Width | Changes |
| --- | --- | --- |
| Desktop | 1024px and up | Layout as described in section 3 |
| Tablet | 768 to 1023px | Inner column 704px at 768; header keeps four links; About side column stacks below prose; Skills rows keep label-left; Contact QR stays right if it fits, else below |
| Mobile | under 768px | Header 64px with AF, toggle and menu; hero uses H1 style; experience date above title; skills label above items; QR below button; footer stacks |

Reflow is required down to 320px with no horizontal scrolling.

## 5. Theme

- Follows `prefers-color-scheme` by default. The toggle sets `data-theme` on `<html>` and
  stores the choice in `localStorage` under `theme`; a hash-allowed inline script in `<head>`
  applies the stored value before first paint so there is no flash.
- The toggle shows the theme it takes you to: moon in light, sun in dark. Accessible name
  "Switch to dark theme" or "Switch to light theme", updated on toggle; `aria-pressed` is
  not used because the two states are distinct actions.
- Colour changes crossfade over `--duration-base`; no transition on first paint.
- `<meta name="theme-color">` is set for both schemes; `color-scheme` is set on `:root`.

## 6. Motion

Exactly as the `web-quality` skill limits it: hover and focus feedback (fast, standard),
disclosure open and close (base, decelerate and accelerate), theme crossfade (base), and
one reveal per section on first entry into the viewport (opacity and at most 16px rise,
base, decelerate, never repeated). Reveals are added by script after load so content is
never hidden without JavaScript. Both reduced-motion layers in `tokens.css` apply.

## 7. The résumé PDF

- Generated at build from the same content file as the page, so the two never drift.
  Method decided at plan stage; the preferred route is a print stylesheet on a hidden
  `/resume-print` page rendered to PDF by the build (keeps fonts, tokens and one source).
- US Letter, one page if the content allows, two at most. Tagged PDF with the same
  heading order as the site, IBM Plex Sans embedded, document title "Anand Francis –
  Résumé".
- Content: name and headline line; email, LinkedIn, GitHub, site, location; a two-line
  summary in the hero's words; experience (all eight roles; roles before 2019 limited to
  their first two bullets, per C9); education; certifications; skills.
- Linked from Contact, Footer and the QR code. Link text includes format and size.

## 8. Content model and copy governance

- One file, `src/content/profile.yaml`, holds identity, hero, experience, education,
  certifications, skills, recommendations, contact and links. The page, the PDF and the
  QR code all read from it.
- The copy in that file is the approved copy from `intent.md` and the template, with the
  corrections in section 12 once accepted. Any later change to copy is a PR reviewed
  under the `portfolio-voice` skill.
- Schema is validated at build (types for dates, required fields, one recommendation
  minimum), so a malformed edit fails before it deploys.

## 9. Copy transcription

Carried verbatim so the build has one place to read it, with US spelling applied per C3
(accepted): organizations, optimized, enrollment.

**Hero.** Badge: Open to internships. H1: Eleven years keeping systems running. Now I'm
learning to secure them. Body: as in 3.2.

**Experience.**
- 2026 — Now · FTC Development Specialist · Brigham Young University – Idaho.
  Support faculty across Canvas LMS and its integrations — Proctorio, Turnitin, Qualtrics
  and Panopto. / Help faculty use AI tools including ChatGPT, Gemini, Copilot and Claude,
  alongside AI-detection tooling. / Building an internal AI agent with Claude Code that
  answers team questions across scattered documentation.
- 2025 — 2026 · AI Research Assistant · Brigham Young University – Idaho.
  Piloted emerging AI tools — ChatGPT, Gemini, Claude and NotebookLM — against academic
  and administrative use cases. / Reviewed AI governance approaches from other
  universities and the EU AI Act to inform university AI policy. / Advised faculty and
  staff on AI adoption, ran a faculty-fair AI booth, and reviewed the AI 101 pilot course.
- 2023 — 2025 · IT Support Technician, Tier 2 · Brigham Young University – Idaho.
  96.2% CSAT and 96.6% first-time resolution for key university stakeholders. / Managed
  Windows and macOS fleets with Active Directory, SCCM and Jamf Pro MDM. / Ran the full
  fleet lifecycle: procure, image over PXE, provision, deploy, support and retire. /
  Managed Active Directory permissions and coordinated ClearPass 802.1X device enrollment
  across student and employee VLANs.
- 2019 — 2023 · Senior Technician, Technical Support · Dell Technologies.
  Premium Support and Premium Support Plus queues for consumer laptops, desktops and
  Alienware — hardware, software and best-effort third-party support. / 92% CSAT and 86%
  first-time resolution across the US and Canada in a high-volume environment. /
  Outstanding Performance award, Q3 FY20, for sustained KPIs. Top training performer. /
  Flagged incorrect, outdated and missing knowledge-base articles from the live queue —
  over 150 fixed or created as a result.
- 2017 — 2019 · Google Ads Support · Google, via FIS.
  92% CSAT and 90% first-time resolution supporting advertisers across Google Ads and
  Merchant Center, plus basic Google Analytics support. / Built and optimized campaigns
  with advertisers — strategy, network targeting, bidding models, Tag Manager, and policy
  reinstatement for blocked ads. / Subject-matter expert: floor-walked the queue, coaching
  a team of 12 or more on stuck cases in real time.
- 2017 · Associate Product Consultant · Cvent.
  Gathered event requirements over Zoom and phone, assessed product fit, and built client
  events in the platform. / Coordinated web development for registration sites, then
  supported, optimized and troubleshot live client events.
- 2016 — 2017 · Customer Care Professional, Tier 3 · American Express.
  Over 30 calls a day on the Digital Assist and Escalations team — website and mobile-app
  troubleshooting at 90% resolution. / Reported reproducible bugs to product teams,
  de-escalated and resolved customer escalations, and supported Quicken and QuickBooks
  integration. / Earned a G1/L2 annual performance rating for 2016.
- 2015 — 2016 · Technical Support Associate · AT&T, via Convergys.
  Supported U-verse internet, TV and VoIP for the US market. / Modem and router setup,
  DVR errors, connectivity and call quality. / 85% resolution on 15 or more calls a day.

**About.** I have spent eleven years on the other end of the phone and the ticket queue.
AT&T, American Express, Cvent, Google, Dell, and since 2023 Brigham Young University –
Idaho. The through-line has always been the same: someone's system is not doing what they
expect, and my job is to find out why. // That work taught me the parts of security a
syllabus does not cover — how permissions actually get granted, why a fleet drifts out of
compliance, what an escalation looks like while nobody yet knows the cause. At BYU-Idaho
I managed Windows and macOS fleets with Active Directory, SCCM and Jamf, and coordinated
802.1X enrollment across student and employee VLANs. // Right now I work in AI enablement:
helping faculty use these tools sensibly, and building an internal agent with Claude Code
that answers team questions across scattered documentation. I am finishing a B.S. in
Cybersecurity in July 2028 and looking for an internship where I can do security work
alongside people who know more than I do.

**Skills, Recommendations, Contact, Footer.** As in 3.6 to 3.9.

**Metadata.** Title "Anand Francis – IT support to cybersecurity". Description: "Eleven
years in IT and technical support, now studying cybersecurity at BYU-Idaho and looking
for a security internship. Experience, skills and how to reach me." Open Graph image:
a generated card with the name and headline on the canvas colour, no photo.

## 10. Quality gates

All of the `web-quality` skill applies. The acceptance checks that must pass before
version one goes to production:

1. Lighthouse on `/`, mobile and desktop: Performance 95 or higher, Accessibility 100,
   Best Practices 100, SEO 100.
2. axe-core: zero violations in both themes. HTML validation: zero errors.
3. Keyboard walk: skip link, wordmark, four nav links, toggle, both hero buttons, eight
   disclosure buttons, the projects ghost button, the email button, the QR link, three
   footer links, in that order, each with a visible focus ring, in both themes.
4. Contrast script over every text and border pairing used, both themes: all pass.
5. Reflow at 320px: no horizontal scroll. Text at 200%: nothing clipped.
6. Reduced motion emulated: no movement, reveals instant, disclosures still work.
7. Security headers score A or better; CSP has no `unsafe-inline`.
8. No third-party requests in the network log. Home page JavaScript under 30 KB.
9. The PDF opens, is tagged, matches the page content, and is linked with format and size.
10. Screenshots in both themes at the seven widths in section 4 match the template at
    390, 768 and 1440 and look intentional in between.

## 11. Technical decisions for the plan stage

Design-level decisions that the plan (Stage 3, plan mode) confirms or challenges:

- Static site generator: Astro, TypeScript, zero client framework. Pages prerender; the
  four scripts (theme bootstrap, toggle, reveals, disclosures) are plain modules.
- Styling: plain CSS with the design system's custom properties from
  `.claude/skills/acme-design-system/tokens.css`, copied to `src/styles/tokens.css` and
  regenerated from the skill when the design system changes. Class names mirror Figma
  variants (`.btn--primary`, `.btn--lg`, `.badge--success-subtle`). Stylelint forbids raw
  colours, lengths and durations outside the token file. No Tailwind, because the design
  system's handoff contract is CSS variables plus variant-named classes, and Tailwind
  would add a second naming layer and a build dependency for no gain on a one-page site.
- Fonts: self-hosted IBM Plex Sans (400, 500, 600, 700) and IBM Plex Mono (400), Latin
  subset WOFF2, from the Fontsource packages or the IBM Plex release, with metric-matched
  fallbacks.
- Icons: exported from the Figma Icons page as SVG, inlined as an Astro component, stroke
  `currentColor`. Note the Icons page says 1.5px stroke while the template's icon
  descriptions say 2px; the build uses the exported artwork as-is and records which.
- Hosting: Cloudflare Workers with static assets via wrangler; `/resume` handled by the
  asset config or a tiny Worker route that serves the PDF inline; headers set in the
  Worker or `_headers`. Production deploys gated by the release hook from Stage 5.
- QR code: generated at build as SVG from the résumé URL, committed with the build output,
  not fetched from a service.
- PDF: build-time render of a print page to PDF, tagged; tool chosen in the plan.

## 12. Areas of concern for the product owner

Each has a recommendation. Accepting the recommendations as written needs no further
input; a different answer changes the marked sections.

- **C1 (accepted 2 September 2026). Two primary buttons and a hero button pointing at a placeholder.** The template
  has Primary "See my work" in the hero and a Primary email button in Contact, while the
  design system says one primary per view and Contact's own spec says the page's solid
  button lives there. "See my work" would also land on an empty Projects section in
  version one. Recommendation: hero Primary "Get in touch" linking to `#contact` (same
  action as Contact's button, so the two primaries are one action seen twice, never in
  the same viewport) and hero Secondary "See my experience" linking to `#experience`.
  Affects 3.2.
- **C2 (accepted 2 September 2026). Projects placeholder wording.** The template already carries a real card for the
  design system project with a thumbnail and a "Read" link that goes nowhere. The intent
  chose a placeholder. Recommendation: ship the empty state in 3.4 with the proposed copy;
  the card arrives with the first write-up as its own change. If you would rather show the
  card now with the link removed, say so and 3.4 changes.
- **C3 (accepted 2 September 2026). Spelling convention.** The approved copy is British (organisations, optimised,
  enrolment) while the audience and location are American. The voice skill only requires
  consistency. Recommendation: switch to US spelling site-wide in the content file before
  build (organizations, optimized, enrollment; "résumé" keeps its accents either way).
  This edits approved copy, so it needs your yes. Affects section 9 and the skill.
- **C4 (accepted 2 September 2026). "CV" footer link.** It has no target in the template and the intent lists only a
  résumé. Recommendation: drop it. Affects 3.9.
- **C5 (confirmed 2 September 2026). Recommendation text.** The template shows an edited, shorter quote; the intent says
  quote in full. Recommendation: the LinkedIn text verbatim as in 3.7, including its
  punctuation ("uplifts colleagues, and users"). Confirm.
- **C6 (accepted 2 September 2026). Certification names and count.** The template lists two certifications and calls
  one "Gemini Certified Student"; LinkedIn has "Gemini Certified University Student" and a
  third, CompTIA ITF+. Recommendation: three entries with the LinkedIn names, as in 3.5.
- **C7 (resolved 2 September 2026: rows kept as they are, no Security row). Skills honesty check.** The AI tooling row names Antigravity, Grok Build and
  OpenRouter, none of which appear on LinkedIn. Under the section's own rule, confirm each
  is something you can do on day one. Optional: a fourth row, SECURITY, listing only what
  Security+ and coursework have made real (for example, Wireshark, Nmap, incident
  response fundamentals). Recommendation: keep the three rows as approved unless you want
  to add or remove specific tools; add a Security row only if every item passes the rule.
- **C8 (accepted 2 September 2026). Portrait.** The design system's About block has a portrait slot; the template has
  none. Recommendation: no photo in version one. It keeps the LCP element as text and
  avoids a photography task; it can be added later as a small change.
- **C9 (accepted 2 September 2026). Résumé length.** Eight roles with every bullet will not fit one Letter page.
  Recommendation: the PDF keeps all eight roles but limits roles before 2019 to their
  first two bullets, and targets two pages maximum. Confirm, or name the roles to trim.
- **C10 (accepted 2 September 2026). Footer credit.** "Designed in Figma" is true; the site is also built with Claude
  Code under this playbook, which is part of the story a recruiter might value.
  Recommendation: keep the template text for version one; revisit when the design system
  case study ships, where the credit belongs.

## 13. Traceability

- Intent to spec: every content item in `intent.md` section "Proposed outcome" maps to a
  subsection of section 3; every constraint maps to sections 4 to 7 and 11; every
  out-of-scope item is absent from sections 2 and 3.
- Skills in force at this draft: `acme-design-system`, `portfolio-voice`, `web-quality`,
  as committed alongside this file.
- Prompt used to produce this draft, for the record: read the accepted intent.md and
  produce a requirements and design spec for the site, applying the design system, voice
  and web quality skills, documenting the spec fully as spec.md ready for planning, and
  describing every area of concern, especially where policies conflict.
