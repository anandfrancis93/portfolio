// Shape of src/content/profile.yaml. A malformed edit fails the build before it deploys:
// objects are strict, so a mistyped or leftover key is an error rather than dropped copy.
// Erasable TypeScript only (no enums, no parameter properties) so Node can import this file
// directly from the build scripts.
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const anchor = z.string().regex(/^#[a-z][a-z0-9-]*$/, "anchor links look like #section");
const sitePath = z.string().regex(/^\/[a-z0-9-/]*$/, "site paths are root-relative");
// External links are https only; the schema is the gate against javascript: and http: hrefs.
const externalUrl = z.url({ protocol: /^https$/ });
const href = z.union([anchor, sitePath, externalUrl]);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM");
const year = z.number().int().min(2000).max(2100);

const style = z.enum(["primary", "secondary", "ghost"]);
const action = z.strictObject({ label: nonEmpty, href, style });

const sectionHead = {
  eyebrow: nonEmpty,
  heading: nonEmpty,
};

export const roleSchema = z
  .strictObject({
    title: nonEmpty,
    org: nonEmpty,
    start: year,
    end: year.nullable(),
    bullets: z.array(nonEmpty).min(1),
  })
  .refine((r) => r.end === null || r.end >= r.start, {
    message: "a role cannot end before it starts",
  });

const rolesSchema = z
  .array(roleSchema)
  .min(1)
  .refine((roles) => roles.every((r, i) => i === 0 || r.start <= roles[i - 1].start), {
    message: "roles are listed newest first",
  });

export const profileSchema = z.strictObject({
  identity: z.strictObject({
    name: nonEmpty,
    wordmark: nonEmpty,
    monogram: z.string().length(2),
    headline: nonEmpty,
    location: nonEmpty,
    email: z.email(),
    siteUrl: externalUrl,
    links: z.strictObject({
      github: externalUrl,
      linkedin: externalUrl,
    }),
  }),
  meta: z.strictObject({
    title: nonEmpty.max(60),
    description: nonEmpty.max(154),
    ogImageAlt: nonEmpty,
  }),
  // Interface strings that are not section copy but are still words on the site.
  ui: z.strictObject({
    skipLink: nonEmpty,
    navLabel: nonEmpty,
    theme: z.strictObject({ toDark: nonEmpty, toLight: nonEmpty }),
    menu: z.strictObject({ label: nonEmpty, open: nonEmpty, close: nonEmpty }),
  }),
  nav: z.array(z.strictObject({ label: nonEmpty, href: anchor })).length(4),
  hero: z.strictObject({
    badge: nonEmpty,
    heading: nonEmpty,
    body: nonEmpty,
    actions: z
      .array(action)
      .length(2)
      .refine(
        (a) => a.filter((x) => x.style === "primary").length === 1 && a[1].style === "secondary",
        { message: "the hero has one primary action followed by one secondary action" },
      ),
  }),
  experience: z.strictObject({
    ...sectionHead,
    roles: rolesSchema,
  }),
  projects: z.strictObject({
    ...sectionHead,
    lede: nonEmpty,
    empty: z.strictObject({ body: nonEmpty, action }),
  }),
  about: z.strictObject({
    ...sectionHead,
    paragraphs: z.array(nonEmpty).min(1),
    education: z.strictObject({
      eyebrow: nonEmpty,
      entries: z
        .array(z.strictObject({ title: nonEmpty, institution: nonEmpty, detail: nonEmpty }))
        .min(1),
    }),
    certifications: z.strictObject({
      eyebrow: nonEmpty,
      entries: z
        .array(
          z.strictObject({
            title: nonEmpty,
            issuer: nonEmpty,
            from: yearMonth,
            to: yearMonth.nullable(),
          }),
        )
        .min(1),
    }),
  }),
  skills: z.strictObject({
    ...sectionHead,
    lede: nonEmpty,
    groups: z.array(z.strictObject({ label: nonEmpty, items: z.array(nonEmpty).min(1) })).min(1),
  }),
  recommendations: z.strictObject({
    ...sectionHead,
    entries: z
      .array(
        z.strictObject({
          quote: nonEmpty,
          name: nonEmpty,
          title: nonEmpty,
          source: externalUrl,
        }),
      )
      .min(1),
  }),
  contact: z.strictObject({
    ...sectionHead,
    body: nonEmpty,
    resume: z.strictObject({
      label: nonEmpty,
      caption: nonEmpty,
      href: sitePath,
      linkText: nonEmpty,
    }),
  }),
  footer: z.strictObject({
    copyright: nonEmpty.includes("{year}"),
    credit: nonEmpty,
    links: z.array(z.strictObject({ label: nonEmpty, href })).min(1),
  }),
  notFound: z.strictObject({
    title: nonEmpty,
    body: nonEmpty,
    action,
  }),
  resume: z.strictObject({
    filename: z.string().regex(/^[a-z0-9-]+\.pdf$/),
    summary: nonEmpty,
    olderRoles: z.strictObject({ before: year, bulletLimit: z.number().int().min(1) }),
  }),
});

export type Profile = z.infer<typeof profileSchema>;
export type Role = z.infer<typeof roleSchema>;
