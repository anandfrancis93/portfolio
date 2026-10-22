// The no-address check of intent 004: no tracked file may hold an address at the Gmail domain,
// and no local .env file may define CONTACT_EMAIL. The pattern is built from parts so that this
// file, and the tests that import it, never match it themselves. Findings name a file and a
// line number, never the line, so a public log never repeats an address.

const DOMAIN = ["gmail", "com"].join("\\.");

/** An address at the Gmail domain, in any case. */
export const ADDRESS = new RegExp(`[A-Za-z0-9._%+-]+@${DOMAIN}\\b`, "i");

/** The 1-based numbers of the lines of `text` that hold an address at the Gmail domain. */
export function addressLines(text) {
  const lines = [];
  text.split("\n").forEach((line, index) => {
    if (ADDRESS.test(line)) lines.push(index + 1);
  });
  return lines;
}

/** Whether a .env file's text assigns CONTACT_EMAIL, with or without `export`. */
export function definesContactEmail(text) {
  return /^\s*(?:export\s+)?CONTACT_EMAIL\s*=/m.test(text);
}

/** `.env` and `.env.*`, the names Vite's loadEnv reads, except the committed example. */
export function isEnvFile(name) {
  return (name === ".env" || name.startsWith(".env.")) && name !== ".env.example";
}
