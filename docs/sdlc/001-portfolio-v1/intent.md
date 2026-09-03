# Intent: anandfrancis.com, version one

Author: Anand Francis. Status: accepted by the product owner on 2 September 2026 (ca08c2c).
Delivered as version one, released 3 September 2026; see `plan.md`, section "Release".

## Problem

I have eleven years in IT and technical support behind me and I am partway through a B.S. in
Cybersecurity at BYU-Idaho. Right now there is no single place where a recruiter, a hiring
manager or a peer can see that story: what I have done, what I can do, and what I am looking
for. A resume shows the roles but not the through-line, and it cannot show work.

## Proposed outcome

A personal site at anandfrancis.com that tells the story in my own voice: eleven years finding
out why systems fail, now learning to secure them. A cybersecurity recruiter or hiring manager
should finish reading with a clear picture of me and either get in touch or open my resume.
A peer or professional contact should be able to see what I have done.

Version one contains, in this order of importance:

- Experience: the eight roles across six organisations since 2015, as already confirmed. The
  current title is FTC Development Specialist.
- Projects: ships as a placeholder section in version one. The projects and their write-ups
  come in a later change, written together.
- About: the through-line, in first person.
- Skills, certifications and education. Certifications are CompTIA Security+ (Dec 2025 to Dec 2028),
  Gemini Certified University Student (Oct 2025 to Oct 2028) and CompTIA ITF+ (Jul 2025).
  Education is the B.S. in Cybersecurity at BYU-Idaho, expected July 2028.
- Recommendations from people I have worked with. Version one has one, from Manoel Galvao,
  Technology Manager, who supervised me on the IT Tier 2 team, quoted in full from LinkedIn.
- Resume download, generated from the site's own content at build time so the two never drift.
- Contact by email link to anand.francis93@gmail.com.

The look comes from my existing Acme design system in Figma (IBM Plex Sans, blue brand on slate
neutrals, light and dark themes). The design system's Template - Portfolio page is the starting
point for the layout, to be adapted rather than copied. The writing is first person and
plain-spoken. Dark mode ships in version one. Motion is limited to subtle reveals as sections
scroll into view, hover states, and a smooth theme switch, and it must respect the reduced-motion
setting.

## Affected users and systems

- Me, as owner, product owner and reviewer.
- Recruiters and hiring managers in cybersecurity, the primary readers.
- Peers, professors and professional contacts, the secondary readers.
- Cloudflare: the anandfrancis.com domain and DNS, and hosting on Workers with static assets.
- The Acme design system Figma file, which the site consumes rather than reinvents. Its page map
  is in docs/design-system/figma-pages.md; it already holds portfolio components such as Hero,
  Project card, Experience entry, About block, Contact section and Site footer.
- A GitHub repository under github.com/anandfrancis93 holding the site, its process artifacts
  and its CI.
- My LinkedIn profile at linkedin.com/in/anandfrancis93, which the site links to and must not
  contradict.

## Constraints

- Hosting is Cloudflare Workers with static assets, on the free tier.
- The design system is the source of truth for color, type, spacing and components.
- No hard deadline.
- No third-party analytics in version one; it is planned for later.
- Every change goes through the AI-native SDLC: intent, spec, plan, PR review, gated deploy.

## Out of scope for version one

- A blog or any writing section.
- A contact form or any server-side handling. Contact is an email link.
- Analytics.
- Expired certifications. The two Google Analytics certificates from 2018 stay off.
- Project write-ups. The section exists, the content comes in a later change.

## Success measures

- At launch: a link I am proud to put on my resume and LinkedIn, and a site that scores well on
  performance and accessibility.
- Within a few months: a recruiter mentions the site in a call, and internship interviews come
  from it.

## Open questions

None at the time of commit. Everything raised during intake was answered above.
