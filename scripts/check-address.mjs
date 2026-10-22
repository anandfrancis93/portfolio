// Intent 004's fast check: no tracked file holds an address at the Gmail domain, so a later
// commit cannot spell the contact address again, and no .env file at the root defines
// CONTACT_EMAIL, since astro build loads those files and the scripts and the tests do not.
// Names files and line numbers only. Binary files (attr -text, the fonts) are read as latin1, so
// an image or a PDF with the address in its text is caught too.
//   node scripts/check-address.mjs
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addressLines, definesContactEmail, isEnvFile } from "./lib/address.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const listing = execFileSync("git", ["ls-files", "--eol", "-z"], { cwd: root, encoding: "utf8" });

const findings = [];
let files = 0;
for (const entry of listing.split("\0").filter(Boolean)) {
  const [attrs, path] = entry.split("\t");
  files += 1;
  let text;
  try {
    text = readFileSync(resolve(root, path), /\bi\/-text\b/.test(attrs) ? "latin1" : "utf8");
  } catch {
    continue; // deleted in the working tree but still in the index
  }
  for (const line of addressLines(text))
    findings.push(`${path}:${line}: an address at the Gmail domain`);
}
for (const name of readdirSync(root).filter(isEnvFile)) {
  if (definesContactEmail(readFileSync(resolve(root, name), "utf8"))) {
    findings.push(
      `${name}: defines CONTACT_EMAIL; export it in the shell instead (docs/runbook.md)`,
    );
  }
}

if (findings.length > 0) {
  console.error(`Address check:\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(`Address check: ${files} tracked files, no address at the Gmail domain.`);
