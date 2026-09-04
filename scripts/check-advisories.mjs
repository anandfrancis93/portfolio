// The advisories this project has chosen to live with. pnpm honours two lists under
// pnpm.auditConfig in package.json, ignoreCves matched on CVE identifiers and ignoreGhsas on
// GitHub's own, and `pnpm audit` passes over both, so nothing else would notice a patch
// arriving. This asks GitHub's advisory database for each entry and fails when any now has a
// patched version, so a silence cannot outlive its reason. It needs the network, so it runs in
// the weekly watch workflow and never in `pnpm check`, which stays offline.
//
// It fails when it cannot tell, not only when it learns something bad: an unreachable database,
// an answer in a shape it does not recognise, or an identifier the database does not know are
// all failures, because a check that passes when it learned nothing is worse than no check.
//
// The dismissed Dependabot alerts are a second silence, and this does not read them: that needs
// a repository token with security-events access, which the watch does not carry. Every advisory
// dismissed there is in one of these lists too, by the rule in CLAUDE.md, so the lists are the
// record.
//   node scripts/check-advisories.mjs
//   node scripts/check-advisories.mjs --api <url> --manifest <path>   (the tests)
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

/** The value of --name, given as two arguments or as --name=value. Refuses a repeat. */
const option = (name) => {
  const found = [];
  for (let at = 0; at < args.length; at += 1) {
    if (args[at] === name) {
      const value = args[at + 1];
      if (value === undefined || value.startsWith("--")) {
        console.error(`${name} needs a value.`);
        process.exit(1);
      }
      found.push(value);
      at += 1;
    } else if (args[at].startsWith(`${name}=`)) {
      found.push(args[at].slice(name.length + 1));
    }
  }
  if (found.length > 1) {
    console.error(`${name} was given more than once.`);
    process.exit(1);
  }
  return found[0] ?? null;
};
const unknown = args.filter((arg) => arg.startsWith("--") && !/^--(api|manifest)(=|$)/.test(arg));
if (unknown.length > 0) {
  console.error(`unknown option: ${unknown[0]}`);
  process.exit(1);
}

// The tests point this at a loopback stand-in. Anything else would send the identifiers, which
// are public, somewhere unintended, so only loopback is accepted as an override.
const DEFAULT_API = "https://api.github.com/advisories";
const apiText = option("--api") ?? DEFAULT_API;
let api;
try {
  api = new URL(apiText);
} catch {
  console.error(`--api is not a URL: ${JSON.stringify(apiText)}`);
  process.exit(1);
}
if (apiText !== DEFAULT_API) {
  const host = api.hostname.replace(/^\[|\]$/g, "");
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    console.error("--api accepts a loopback address only.");
    process.exit(1);
  }
}

const manifestPath = resolve(root, option("--manifest") ?? "package.json");
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  console.error(`${manifestPath} could not be read: ${error.message}`);
  process.exit(1);
}

const auditConfig = manifest.pnpm?.auditConfig ?? {};
const lists = [
  ["ignoreCves", auditConfig.ignoreCves ?? [], "cve_id", /^CVE-\d{4}-\d{4,}$/i],
  [
    "ignoreGhsas",
    auditConfig.ignoreGhsas ?? [],
    "ghsa_id",
    /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/i,
  ],
];
const silenced = [];
for (const [name, list, parameter, shape] of lists) {
  if (!Array.isArray(list) || list.some((id) => typeof id !== "string")) {
    console.error(`pnpm.auditConfig.${name} must be a list of identifiers.`);
    process.exit(1);
  }
  for (const id of list) {
    if (!shape.test(id)) {
      console.error(
        `pnpm.auditConfig.${name} holds ${JSON.stringify(id)}, which pnpm will not match.`,
      );
      process.exit(1);
    }
    silenced.push({ id, parameter });
  }
}

if (silenced.length === 0) {
  console.log("Advisory check: 0 silenced, none patched.");
  process.exit(0);
}

const problems = [];
const clean = [];
for (const { id, parameter } of silenced) {
  const url = new URL(api);
  url.searchParams.set(parameter, id);
  url.searchParams.set("per_page", "1");
  let body;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/vnd.github+json", "user-agent": "anandfrancis.com" },
    });
    if (!response.ok) {
      problems.push(`${id}: the advisory database answered ${response.status}`);
      continue;
    }
    body = await response.json();
  } catch (error) {
    problems.push(`${id}: the advisory database could not be reached (${error.message})`);
    continue;
  }
  if (!Array.isArray(body)) {
    problems.push(`${id}: the advisory database answered in a shape this check does not know`);
    continue;
  }
  const [advisory] = body;
  if (!advisory) {
    problems.push(`${id}: no such advisory, so the silence names nothing`);
    continue;
  }
  if (!Array.isArray(advisory.vulnerabilities) || advisory.vulnerabilities.length === 0) {
    problems.push(`${id}: the advisory lists no affected package, so a patch cannot be read`);
    continue;
  }
  const patched = advisory.vulnerabilities
    .map((vulnerability) => vulnerability?.first_patched_version)
    .filter((version) => typeof version === "string" && version.length > 0);
  if (patched.length > 0) {
    problems.push(
      `${id} now has a patched version (${[...new Set(patched)].join(", ")}); upgrade and take it out of pnpm.auditConfig`,
    );
  } else {
    clean.push(id);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`Advisory check: ${problem}.`);
  process.exit(1);
}
console.log(`Advisory check: ${clean.length} silenced, none patched (${clean.join(", ")}).`);
