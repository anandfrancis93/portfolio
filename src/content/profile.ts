// Loads and validates src/content/profile.yaml once, and exports the typed result with the
// formatting helpers the page and the résumé share. Importable from Astro and from Node
// build scripts alike (erasable TypeScript only).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { profileSchema, type Profile, type Role } from "./schema.ts";

const file = fileURLToPath(new URL("./profile.yaml", import.meta.url));

export function loadProfile(source: string = readFileSync(file, "utf8")): Profile {
  const result = profileSchema.safeParse(parse(source));
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`profile.yaml is invalid:\n${lines.join("\n")}`);
  }
  return result.data;
}

export const profile: Profile = loadProfile();

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

/** Every string in the profile, with its path, for checks that read the copy. */
export function collectStrings(value: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof value === "string") return [[path.join("."), value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => collectStrings(v, [...path, `${i}`]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => collectStrings(v, [...path, k]));
  }
  return [];
}
