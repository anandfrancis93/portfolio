// Validates the profile and provides the formatting helpers the page and the résumé share.
// This module reads no files and touches no Node API, so it is safe to import anywhere:
// Astro pages get the loaded profile from ./site.ts; Node scripts and tests read the YAML
// themselves and call loadProfile. Erasable TypeScript only.
import { parse } from "yaml";
import { profileSchema, type Profile, type Role } from "./schema.ts";

export type { Profile, Role };

export function loadProfile(source: string): Profile {
  const result = profileSchema.safeParse(parse(source));
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`profile.yaml is invalid:\n${lines.join("\n")}`);
  }
  return result.data;
}

/** "2019 — 2023", "2026 — Now", or "2017" for a role that started and ended in one year. */
export function formatSpan(role: Pick<Role, "start" | "end">): string {
  if (role.end === null) return `${role.start} — Now`;
  if (role.end === role.start) return `${role.start}`;
  return `${role.start} — ${role.end}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2025-12" becomes "December 2025". */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** "December 2025 – December 2028", or "July 2025" when there is no expiry. */
export function formatCertificationDates(entry: { from: string; to: string | null }): string {
  return entry.to === null
    ? formatMonth(entry.from)
    : `${formatMonth(entry.from)} – ${formatMonth(entry.to)}`;
}

/** Bullets the résumé shows for a role: older roles are trimmed to the configured limit. */
export function resumeBullets(role: Role, rules: Profile["resume"]["olderRoles"]): string[] {
  return role.start < rules.before ? role.bullets.slice(0, rules.bulletLimit) : role.bullets;
}

/** "© 2026 Anand Francis" from the footer template and the build year. */
export function formatCopyright(template: string, year: number): string {
  return template.replace("{year}", String(year));
}

/** Every string in the profile, with its path, for checks that read the copy. */
export function collectStrings(value: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof value === "string") return [[path.join("."), value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => collectStrings(v, [...path, `${i}`]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => collectStrings(v, [...path, k]));
  }
  return [];
}
