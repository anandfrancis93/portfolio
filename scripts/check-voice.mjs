// Checks every string in src/content/profile.yaml against the portfolio-voice skill: banned
// hype words in any inflection, exclamation marks, British spellings, the fixed facts, and the
// recommendation quoted verbatim against the LinkedIn text. Exits 1 on findings.
//   node scripts/check-voice.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectStrings, loadProfile } from "../src/content/profile.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = loadProfile(readFileSync(resolve(root, "src/content/profile.yaml"), "utf8"));

const BANNED = [
  "passionate",
  "leverage",
  "synergy",
  "cutting-edge",
  "world-class",
  "rockstar",
  "ninja",
  "guru",
  "seamless",
  "robust",
  "innovative",
  "dynamic",
  "results-driven",
  "proven track record",
];

// British forms the copy must not use (US English site-wide, decided in the spec).
const BRITISH = [
  /\borganis(e|ed|es|ing|ation|ations)\b/i,
  /\boptimis(e|ed|es|ing|ation)\b/i,
  /\benrolment\b/i,
  /\bcolour(s|ed)?\b/i,
  /\bbehaviours?\b/i,
  /\bcentre(s|d)?\b/i,
  /\blicence\b/i,
  /\bfavour(s|ed|ite)?\b/i,
  /\bapologis(e|ed)\b/i,
  /\bartefacts?\b/i,
  /\bprogrammes?\b/i,
  /\bcatalogue\b/i,
  /\banalys(e|ed|es|ing)\b/i,
  /\brecognis(e|ed|es|ing)\b/i,
  /\bprioritis(e|ed|es|ing)\b/i,
  /\bnormalis(e|ed|es|ing)\b/i,
];

// The recommendation as it appears on LinkedIn, typographic apostrophes included. Rule 10 of
// the voice skill: reproduced exactly, never trimmed or improved.
const LINKEDIN_QUOTE =
  "I’ve supervised Francis in our IT Tier 2 team and have been impressed by his blend of " +
  "technical depth, quick learning, and open-minded approach. He resolves incidents calmly " +
  "and efficiently, absorbs new tools at speed, uplifts colleagues, and users with his " +
  "positive attitude. Any organization would benefit from Francis’s reliable, " +
  "forward-thinking professionalism.";

const strings = collectStrings(profile);
const findings = [];
const collapse = (s) => s.replace(/\s+/g, " ").trim();

for (const [path, value] of strings) {
  if (path.startsWith("identity.links") || path.endsWith(".href") || path.endsWith(".source"))
    continue;
  for (const word of BANNED) {
    const stem = word.replace(/[-\s]/g, "[-\\s]");
    const re = new RegExp(`\\b${stem}(s|d|es|ly|ing|ness|ation|ations)?\\b`, "i");
    if (re.test(value)) findings.push(`${path}: banned word "${word}"`);
  }
  if (value.includes("!")) findings.push(`${path}: exclamation mark`);
  for (const re of BRITISH) {
    const m = re.exec(value);
    if (m) findings.push(`${path}: British spelling "${m[0]}"`);
  }
}

// Fixed facts from the voice skill.
const facts = [
  [profile.identity.name === "Anand Francis", "identity.name must be Anand Francis"],
  [
    profile.identity.email === "anand.francis93@gmail.com",
    "identity.email is the public Gmail address",
  ],
  [
    profile.experience.roles[0].title === "FTC Development Specialist",
    "the current role is FTC Development Specialist",
  ],
  [
    profile.about.education.entries[0].detail.includes("July 2028"),
    "graduation is expected July 2028",
  ],
  [profile.recommendations.entries.length >= 1, "at least one recommendation"],
  [
    collapse(profile.recommendations.entries[0].quote) === LINKEDIN_QUOTE,
    "the recommendation is the LinkedIn text verbatim",
  ],
  [
    profile.recommendations.entries[0].name === "Manoel Galvao",
    "the recommendation is attributed to Manoel Galvao",
  ],
];
for (const [ok, msg] of facts) if (!ok) findings.push(`fixed fact: ${msg}`);

if (findings.length > 0) {
  console.error(`Voice check failed (${findings.length}):\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `Voice check passed: ${strings.length} strings, no banned words, US spelling, facts hold, quote verbatim.`,
);
