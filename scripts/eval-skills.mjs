// The skill-trigger eval (spec.md section 2.6), run by hand before any PR that changes a file
// under .claude/skills: sends each prompt below through headless Claude Code with only the Skill
// tool allowed and no MCP servers, so the one action open to the model is loading a skill, and
// reports which skill each prompt loaded. Draws on the developer's own subscription; not part of check or verify.
//   pnpm eval:skills                 every prompt
//   pnpm eval:skills --model sonnet  a different model
//   pnpm eval:skills --only web-quality
// A prompt that should load a skill and did not is run once more, because the judgement is a
// model's; a second miss fails the script. Prints "Skill eval: N prompts, N pass, N miss".
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : null;
};
const model = option("--model");
const only = option("--only");

// Worded as a user would ask, one change each. `skill: null` should load nothing.
const PROMPTS = [
  {
    skill: "acme-design-system",
    prompt: "Make the footer's top border one step darker on the light theme.",
  },
  {
    skill: "acme-design-system",
    prompt: "The hero heading looks too tight on phones; adjust its letter spacing.",
  },
  {
    skill: "acme-design-system",
    prompt: "Give the recommendation card a soft shadow so it sits above the band.",
  },
  {
    skill: "portfolio-voice",
    prompt: "Rewrite the paragraph in the contact section so it sounds warmer.",
  },
  {
    skill: "portfolio-voice",
    prompt: "Write alt text for a screenshot of the design system's token table.",
  },
  {
    skill: "portfolio-voice",
    prompt: "The meta description is too long by ten characters; shorten it.",
  },
  {
    skill: "web-quality",
    prompt: "Add payment to the features the Permissions-Policy header denies.",
  },
  {
    skill: "web-quality",
    prompt: "The theme toggle's tap target feels small on phones; make it comfortable.",
  },
  {
    skill: "web-quality",
    prompt: "Preload the 600 weight of IBM Plex Sans as well as the 400 and 500.",
  },
  { skill: null, prompt: "What is the URL of this repository's git remote?" },
  { skill: null, prompt: "Which version of Playwright does the lockfile pin?" },
];

/** Runs one prompt and returns the set of skills the model loaded. */
function loadedSkills(prompt) {
  const cli = [
    "-p",
    `"${prompt.replace(/"/g, '\\"')}"`,
    "--output-format",
    "stream-json",
    "--verbose",
    // --tools limits the built-in set to Skill; --allowedTools alone only pre-approves it and
    // leaves every tool the settings allow, which on the first probe edited a stylesheet.
    "--tools",
    "Skill",
    "--allowedTools",
    "Skill",
    "--disallowedTools",
    "Bash,PowerShell,Edit,Write,MultiEdit,NotebookEdit,Agent,WebFetch,WebSearch",
    // No MCP servers: the skills are files in the project, and a server that waits for a
    // browser or a login would stall a headless run.
    "--strict-mcp-config",
    ...(model ? ["--model", model] : []),
  ];
  const result = spawnSync("claude", cli, {
    input: "",
    cwd: root,
    encoding: "utf8",
    shell: true,
    windowsHide: true,
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  const loaded = new Set();
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const blocks = event?.message?.content ?? event?.content ?? [];
    for (const block of Array.isArray(blocks) ? blocks : []) {
      if (block?.type === "tool_use" && block.name === "Skill") {
        const name = block.input?.skill ?? block.input?.name;
        if (name) loaded.add(String(name).replace(/^.*:/, ""));
      }
    }
  }
  if (result.status !== 0 && loaded.size === 0) {
    const tail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim().split(/\r?\n/).slice(-5);
    throw new Error(`claude exited ${result.status}:\n${tail.join("\n")}`);
  }
  return loaded;
}

const rows = only ? PROMPTS.filter((p) => p.skill === only) : PROMPTS;
let pass = 0;
let miss = 0;
for (const { skill, prompt } of rows) {
  let loaded = loadedSkills(prompt);
  let verdict = skill ? loaded.has(skill) : loaded.size === 0;
  let note = "";
  if (!verdict && skill) {
    loaded = loadedSkills(prompt);
    verdict = loaded.has(skill);
    note = " (second run)";
  }
  if (verdict) pass += 1;
  else miss += 1;
  const want = skill ?? "(no skill)";
  const got = loaded.size ? [...loaded].join(", ") : "(none)";
  console.log(
    `${verdict ? "pass" : "miss"}  ${want.padEnd(18)}  loaded ${got}${note}  "${prompt}"`,
  );
}

console.log(`Skill eval: ${rows.length} prompts, ${pass} pass, ${miss} miss`);
process.exit(miss > 0 ? 1 : 0);
