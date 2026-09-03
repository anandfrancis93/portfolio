// The shape of the agent's configuration (spec.md section 2.4): every skill has a SKILL.md whose
// frontmatter names its folder and describes when it applies; the skills the process documents
// cite exist; the token sheet the sync script compares against is the skill's; every agent
// definition is well formed; every hook in settings.json is a real file that parses and is
// registered on the tools it expects; and the launch configuration agrees with the preview port.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { backticked, frontmatter, read, root } from "./helpers.mjs";

const KNOWN_TOOLS = new Set([
  "Bash",
  "PowerShell",
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Agent",
  "Task",
  "Skill",
  "NotebookEdit",
  "TodoWrite",
]);

const dirs = (rel) =>
  readdirSync(resolve(root, rel)).filter((name) =>
    statSync(resolve(root, rel, name)).isDirectory(),
  );

describe("skills", () => {
  const skills = dirs(".claude/skills");
  it("exist", () => assert.ok(skills.length >= 3, "expected at least the three skills"));
  for (const skill of skills) {
    it(`${skill} has a SKILL.md whose frontmatter names it and says when it applies`, () => {
      const path = `.claude/skills/${skill}/SKILL.md`;
      assert.ok(existsSync(resolve(root, path)), `${path} is missing`);
      const fm = frontmatter(read(path));
      assert.ok(fm, `${path} has no frontmatter`);
      assert.equal(fm.name, skill, `${path} names "${fm.name}", not its folder`);
      assert.ok(fm.description && fm.description.length > 20, `${path} has no description`);
      assert.ok(fm.description.length <= 1024, `${path} description is over 1024 characters`);
    });
  }

  it("are the ones CLAUDE.md, REVIEW.md and the specs cite", () => {
    const specs = readdirSync(resolve(root, "docs/sdlc"))
      .map((change) => `docs/sdlc/${change}/spec.md`)
      .filter((rel) => existsSync(resolve(root, rel)));
    const cited = new Set(
      ["CLAUDE.md", "REVIEW.md", ...specs]
        .flatMap((rel) => backticked(read(rel)))
        .map((t) => t.replace(/^\.claude\/skills\//, ""))
        .filter((t) => skills.includes(t) || /^[a-z]+(-[a-z]+)+$/.test(t)),
    );
    for (const skill of skills) assert.ok(cited.has(skill), `CLAUDE.md never cites ${skill}`);
    for (const name of cited) {
      if (skills.includes(name)) continue;
      assert.ok(
        !["acme-design-system", "portfolio-voice", "web-quality"].includes(name),
        `${name} is cited but has no folder`,
      );
    }
  });

  it("supply the token sheet the sync script compares against", () => {
    const source = read("scripts/sync-tokens.mjs");
    const path = /["'`](\.claude\/skills\/[^"'`]+tokens\.css)["'`]/.exec(source)?.[1];
    assert.ok(path, "sync-tokens.mjs names no skill token sheet");
    assert.ok(existsSync(resolve(root, path)), `${path} does not exist`);
  });
});

describe("agents", () => {
  const files = readdirSync(resolve(root, ".claude/agents")).filter((f) => f.endsWith(".md"));
  it("exist", () => assert.ok(files.length >= 1, "expected at least the verifier"));
  for (const file of files) {
    it(`${file} is well formed`, () => {
      const fm = frontmatter(read(`.claude/agents/${file}`));
      assert.ok(fm, `${file} has no frontmatter`);
      assert.equal(fm.name, file.replace(/\.md$/, ""), `${file} names "${fm.name}"`);
      assert.ok(fm.description && fm.description.length > 20, `${file} has no description`);
      assert.ok(fm.tools, `${file} lists no tools`);
      for (const tool of fm.tools.split(",").map((t) => t.trim())) {
        assert.ok(KNOWN_TOOLS.has(tool), `${file} lists an unknown tool "${tool}"`);
      }
    });
  }
});

describe("hook wiring", () => {
  const settings = JSON.parse(read(".claude/settings.json"));
  const entries = [];
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        const file = /\.claude\/hooks\/([\w.-]+)/.exec(hook.command)?.[1];
        entries.push({ event, matcher: group.matcher, file, command: hook.command });
      }
    }
  }
  it("registers at least one hook", () =>
    assert.ok(entries.length > 0, "settings.json has no hooks"));

  for (const entry of entries) {
    it(`${entry.event} ${entry.matcher} runs a hook file that exists and parses`, () => {
      assert.ok(entry.file, `no hook file in "${entry.command}"`);
      const path = resolve(root, ".claude/hooks", entry.file);
      assert.ok(existsSync(path), `${entry.file} does not exist`);
      const check = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
      assert.equal(check.status, 0, check.stderr);
      assert.match(
        entry.command,
        /\$\{CLAUDE_PROJECT_DIR\}/,
        "the command uses CLAUDE_PROJECT_DIR",
      );
    });
  }

  it("registers every file under .claude/hooks", () => {
    const registered = new Set(entries.map((e) => e.file));
    // Hooks are the .mjs files at the top of the folder; lib/ holds what they share.
    for (const file of readdirSync(resolve(root, ".claude/hooks")).filter((f) =>
      f.endsWith(".mjs"),
    )) {
      assert.ok(registered.has(file), `${file} is not registered in settings.json`);
    }
    for (const file of readdirSync(resolve(root, ".claude/hooks/lib"))) {
      const check = spawnSync(
        process.execPath,
        ["--check", resolve(root, ".claude/hooks/lib", file)],
        {
          encoding: "utf8",
        },
      );
      assert.equal(check.status, 0, check.stderr);
    }
  });

  const expected = {
    "guard-tests.mjs": {
      event: "PreToolUse",
      tools: ["Edit", "Write", "Bash", "PowerShell", "mcp__github__push_files"],
    },
    "guard-deploy.mjs": { event: "PreToolUse", tools: ["Bash", "PowerShell"] },
    "format-on-edit.mjs": { event: "PostToolUse", tools: ["Edit", "Write"] },
  };
  for (const [file, want] of Object.entries(expected)) {
    it(`${file} runs on ${want.event} for ${want.tools.join(" and ")}`, () => {
      const entry = entries.find((e) => e.file === file && e.event === want.event);
      assert.ok(entry, `${file} is not registered on ${want.event}`);
      const tools = entry.matcher.split("|");
      for (const tool of want.tools) assert.ok(tools.includes(tool), `${file} misses ${tool}`);
    });
  }
});

describe("launch.json", () => {
  it("previews on the port the preview script uses", () => {
    const launch = JSON.parse(read(".claude/launch.json"));
    const preview = launch.configurations.find((c) => c.name === "preview");
    assert.ok(preview, "no preview configuration");
    // The default and the parser live once, in preview-port.cjs; every consumer loads it.
    const source = read("scripts/lib/preview-port.cjs");
    const port = Number(/DEFAULT_PORT = (\d+)/.exec(source)?.[1]);
    assert.ok(port, "preview-port.cjs names no DEFAULT_PORT");
    assert.equal(preview.port, port);
    for (const rel of [
      "playwright.config.ts",
      "lighthouserc.cjs",
      "scripts/lib/preview-server.mjs",
    ]) {
      assert.ok(read(rel).includes("preview-port.cjs"), `${rel} does not load preview-port.cjs`);
    }
  });
});
