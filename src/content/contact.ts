// The contact address, the one piece of copy that does not live in profile.yaml (intent 004).
// The build reads it from CONTACT_EMAIL in the process environment, which the deploy workflow
// fills from a secret; anywhere else it is the reserved stand-in, so ci, its artifacts and a
// local build never hold the address, and scripts/deploy.mjs refuses a build that shows the
// stand-in. Every caller of loadProfile passes contactEmail(), so the pages, the scripts and
// the tests read the same value. Erasable TypeScript only, so Node can import it directly.

/** RFC 2606 reserves example.com, so the stand-in reaches nobody. */
export const STAND_IN = "contact@example.com";

/** The trimmed CONTACT_EMAIL, or the stand-in when it is unset, empty or blank. */
export function contactEmail(env: Record<string, string | undefined> = process.env): string {
  const value = env.CONTACT_EMAIL?.trim();
  return value ? value : STAND_IN;
}
