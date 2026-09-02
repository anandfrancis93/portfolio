// Shape of src/content/profile.yaml. A malformed edit fails the build before it deploys.
// Erasable TypeScript only (no enums, no parameter properties) so Node can import this file
// directly from the build scripts.
import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const anchor = z.string().regex(/^#[a-z][a-z0-9-]*$/, "anchor links look like #section");
const href = z.union([anchor, z.url(), z.string().regex(/^\/[a-z0-9-/]*$/)]);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM");
const year = z.number().int().min(2000).max(2100);

const action = z.object({
  label: nonEmpty,
  href,
  style: z.enum(["primary", "secondary", "ghost"]).optional(),
});

const sectionHead = {
  eyebrow: nonEmpty,
  heading: nonEmpty,
};

export const roleSchema = z
  .object({
    title: nonEmpty,
    org: nonEmpty,
    start: year,
    end: year.nullable(),
    bullets: z.array(nonEmpty).min(1).max(6),
  })
  .refine((r) => r.end === null || r.end >= r.start, {
    message: "a role cannot end before it starts",
  });

export const profileSchema = z.object({
  identity: z.object({
    name: nonEmpty,
    wordmark: nonEmpty,
    monogram: z.string().length(2),
    headline: nonEmpty,
    location: nonEmpty,
    email: z.email(),
    siteUrl: z.url(),
    links: z.object({
      github: z.url(),
      linkedin: z.url(),
    }),
  }),
  meta: z.object({
    title: nonEmpty.max(70),
    description: nonEmpty.max(155),
  }),
  nav: z
    .array(z.object({ label: nonEmpty, href: anchor }))
    .min(1)
    .max(5),
  hero: z.object({
    badge: nonEmpty,
    heading: nonEmpty,
    body: nonEmpty,
    actions: z.array(action).min(1).max(2),
  }),
  experience: z.object({
    ...sectionHead,
    roles: z.array(roleSchema).min(1),
  }),
  projects: z.object({
    ...sectionHead,
    lede: nonEmpty,
    empty: z.object({ body: nonEmpty, action }),
  }),
  about: z.object({
    ...sectionHead,
    paragraphs: z.array(nonEmpty).min(1),
    education: z.object({
      eyebrow: nonEmpty,
      entries: z
        .array(z.object({ title: nonEmpty, institution: nonEmpty, detail: nonEmpty }))
        .min(1),
    }),
    certifications: z.object({
      eyebrow: nonEmpty,
      entries: z
        .array(
          z.object({
            title: nonEmpty,
            issuer: nonEmpty,
            from: yearMonth,
            to: yearMonth.nullable(),
          }),
        )
        .min(1),
    }),
  }),
  skills: z.object({
    ...sectionHead,
    lede: nonEmpty,
    groups: z.array(z.object({ label: nonEmpty, items: z.array(nonEmpty).min(1) })).min(1),
  }),
  recommendations: z.object({
    ...sectionHead,
    entries: z
      .array(
        z.object({
          quote: nonEmpty,
          name: nonEmpty,
          title: nonEmpty,
          source: z.url(),
        }),
      )
      .min(1),
  }),
  contact: z.object({
    ...sectionHead,
    body: nonEmpty,
    resume: z.object({
      label: nonEmpty,
      caption: nonEmpty,
      href,
      linkText: nonEmpty,
    }),
  }),
  footer: z.object({
    credit: nonEmpty,
    links: z.array(z.object({ label: nonEmpty, href })).min(1),
  }),
  notFound: z.object({
    title: nonEmpty,
    body: nonEmpty,
    action,
  }),
  resume: z.object({
    filename: z.string().regex(/^[a-z0-9-]+\.pdf$/),
    summary: nonEmpty,
    olderRoles: z.object({ before: year, bulletLimit: z.number().int().min(1) }),
  }),
});

export type Profile = z.infer<typeof profileSchema>;
export type Role = z.infer<typeof roleSchema>;
