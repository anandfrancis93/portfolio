// Validates src/content/profile.yaml against its schema and proves the schema bites: a copy
// with the recommendation removed, a role ending before it starts and an unknown key must be
// rejected with a readable message naming each field. Exits 1 on any problem.
//   node scripts/check-content.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { loadProfile } from "../src/content/profile.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/content/profile.yaml"), "utf8");

let failures = 0;

// 1. The real file validates.
try {
  const profile = loadProfile(source);
  console.log(
    `profile.yaml is valid: ${profile.experience.roles.length} roles, ${profile.about.certifications.entries.length} certifications, ${profile.recommendations.entries.length} recommendation(s).`,
  );
} catch (error) {
  failures += 1;
  console.error(error.message);
}

// 2. A broken copy is rejected, and the error names every broken field.
const broken = parse(source);
broken.recommendations.entries = [];
broken.experience.roles[0].end = 2000;
broken.hero.subheading = "a key the schema does not know";
try {
  loadProfile(stringify(broken));
  failures += 1;
  console.error("The schema accepted a copy with three deliberate faults.");
} catch (error) {
  const msg = String(error.message);
  const expected = ["recommendations.entries", "experience.roles.0", "hero"];
  const missing = expected.filter((field) => !msg.includes(field));
  if (missing.length > 0) {
    failures += 1;
    console.error(
      `The schema rejected the broken copy but did not name ${missing.join(", ")}:\n${msg}`,
    );
  } else {
    console.log("The schema rejects a broken copy and names the fields.");
  }
}

process.exit(failures > 0 ? 1 : 0);
