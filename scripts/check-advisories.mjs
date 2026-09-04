// The advisories this project has chosen to live with, from package.json's
// auditConfig.ignoreCves: `pnpm audit` passes them over, so nothing else would ever notice a
// patch arriving. This asks GitHub's advisory database for each one and fails when any now has
// a patched version, so a silence cannot outlive its reason. It needs the network, so it runs
// in the weekly watch workflow and never in `pnpm check`, which stays offline.
//
// The dismissed Dependabot alerts are a second silence, and this does not read them: that needs
// a repository token with security-events access, which the watch does not carry. Every advisory
// dismissed there is in the ignore list too, by the rule in CLAUDE.md, so the list is the record.
//   node scripts/check-advisories.mjs
//   node scripts/check-advisories.mjs --api <url>   (the tests)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return null;
  if (args[at + 1] === undefined || args[at + 1].startsWith("--")) {
    console.error(`${name} needs a value.`);
    process.exit(1);
  }
  return args[at + 1];
};

// The tests point this at a loopback stand-in. Anything else would send the identifiers, which
// are public, somewhere unintended, so only loopback is accepted as an override.
const DEFAULT_API = "https://api.github.com/advisories";
const api = option("--api") ?? DEFAULT_API;
if (api !== DEFAULT_API) {
  const { hostname } = new URL(api);
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "[::1]") {
    console.error("--api accepts a loopback address only.");
    process.exit(1);
  }
}

const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const silenced = manifest.pnpm?.auditConfig?.ignoreCves ?? [];
if (!Array.isArray(silenced) || silenced.some((id) => typeof id !== "string")) {
  console.error("pnpm.auditConfig.ignoreCves must be a list of identifiers.");
  process.exit(1);
}
if (silenced.length === 0) {
  console.log("Advisory check: 0 silenced, none patched.");
  process.exit(0);
}

const problems = [];
const notes = [];
for (const id of silenced) {
  let advisory;
  try {
    const response = await fetch(`${api}?cve_id=${encodeURIComponent(id)}&per_page=1`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "anandfrancis.com" },
    });
    if (!response.ok) {
      problems.push(`${id}: the advisory database answered ${response.status}`);
      continue;
    }
    [advisory] = await response.json();
  } catch (error) {
    problems.push(`${id}: the advisory database could not be reached (${error.message})`);
    continue;
  }
  if (!advisory) {
    problems.push(`${id}: no such advisory, so the silence names nothing`);
    continue;
  }
  const patched = (advisory.vulnerabilities ?? [])
    .map((v) => v.first_patched_version)
    .filter((version) => typeof version === "string" && version.length > 0);
  if (patched.length > 0) {
    problems.push(
      `${id} now has a patched version (${[...new Set(patched)].join(", ")}); upgrade and take it out of auditConfig.ignoreCves`,
    );
  } else {
    notes.push(id);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`Advisory check: ${problem}.`);
  process.exit(1);
}
console.log(`Advisory check: ${notes.length} silenced, none patched (${notes.join(", ")}).`);
