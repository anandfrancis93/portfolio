// CLAUDE.md drift (spec.md section 2.3): every command it names is a package.json script, every
// script a human runs is named in it, every path it names exists, and every healthy-output line
// it quotes is classified in the table below and, where the repository prints the line itself,
// still printed. A phrase this table does not know fails, so a new phrase is classified when it
// is added. The command and path checks also run over docs/runbook.md, the procedures CLAUDE.md
// points to, so what moved out of CLAUDE.md cannot drift either.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { backticked, read, root } from "./helpers.mjs";

const claudeMd = read("CLAUDE.md");
// The runbook takes the same command and path checks; only CLAUDE.md must name every script.
const documents = { "CLAUDE.md": claudeMd, "docs/runbook.md": read("docs/runbook.md") };
const scripts = JSON.parse(read("package.json")).scripts;
const tracked = new Set(
  (spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).stdout ?? "").split(/\r?\n/),
);

/** The body of one `## Heading` section of CLAUDE.md. */
function section(name) {
  const m = new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(claudeMd);
  return m ? m[1] : "";
}
const commands = section("Commands");

/** The pnpm scripts a document names, as `pnpm <name>` or `pnpm run <name>`. */
function namedCommands(text) {
  const named = new Set();
  for (const token of backticked(text)) {
    const m = /^pnpm (?:run )?([\w:.-]+)$/.exec(token);
    if (m && !["install", "exec"].includes(m[1])) named.add(m[1]);
  }
  return named;
}

describe("CLAUDE.md and the runbook name real commands", () => {
  const named = namedCommands(claudeMd);
  for (const token of backticked(commands)) if (token in scripts) named.add(token);

  for (const [file, text] of Object.entries(documents)) {
    for (const name of file === "CLAUDE.md" ? named : namedCommands(text)) {
      it(`pnpm ${name} in ${file} exists in package.json`, () => {
        assert.ok(
          name in scripts,
          `${file} names pnpm ${name}, which package.json does not define`,
        );
      });
    }
  }

  // Every script, the helpers included, so a new one is documented when it is added.
  for (const name of Object.keys(scripts)) {
    it(`package.json script ${name} is named in CLAUDE.md`, () => {
      assert.ok(named.has(name), `package.json defines ${name}, which CLAUDE.md never names`);
    });
  }
});

describe("CLAUDE.md and the runbook name paths that exist", () => {
  const extension = /\.(md|mjs|cjs|js|ts|astro|css|json|yaml|yml|svg)$/;
  // Build outputs, the two git-ignored files, globs, phrases, URLs, variables, class names and
  // flags (`--`), and a bare extension such as `.css`; a root dotfile such as `.gitattributes`
  // is a path like any other and is checked.
  const bareExtension = /^\.(md|mjs|cjs|js|ts|astro|css|json|yaml|yml|svg)$/;
  const skip = (t) =>
    /\s/.test(t) ||
    t.startsWith("dist") ||
    t.startsWith("/") ||
    t.includes("*") ||
    t.includes("{") ||
    t.includes("http") ||
    t.includes("--") ||
    t === ".claude/FIX_TASK" ||
    t === ".claude/settings.local.json" ||
    t === "og.png" ||
    /^[A-Z_]+$/.test(t) ||
    bareExtension.test(t);
  for (const [file, text] of Object.entries(documents)) {
    const candidates = new Set(
      backticked(text).filter(
        (t) => !skip(t) && (t.includes("/") || t.startsWith(".") || extension.test(t)),
      ),
    );
    for (const token of candidates) {
      it(`${token} in ${file} exists`, () => {
        const direct = existsSync(resolve(root, token));
        const byName = !token.includes("/") && [...tracked].some((p) => p.endsWith(`/${token}`));
        assert.ok(direct || byName, `${file} names ${token}, which does not exist`);
      });
    }
  }
});

describe("CLAUDE.md healthy output lines", () => {
  // Every backticked token after "healthy:" inside a Commands bullet is a quoted output line.
  const quoted = new Set();
  for (const bullet of commands.split(/\n(?=- )/)) {
    const at = bullet.indexOf("healthy:");
    if (at < 0) continue;
    // The clause runs to the first semicolon or the end of the bullet.
    const clause = bullet.slice(at).split(";")[0];
    for (const phrase of backticked(clause)) quoted.add(phrase);
  }

  // How each quoted line is checked. "live": the command is run and its last line must match.
  // "source": the phrase must match a string or template literal in the script, `${...}` and N
  // standing for anything. "third-party": printed by a tool this repository does not control.
  const table = [
    { phrase: "Local    http://localhost:4321/", kind: "third-party", tool: "astro dev" },
    { phrase: "Ready on http://127.0.0.1:8788", kind: "third-party", tool: "wrangler dev" },
    { phrase: "[build] Complete!", kind: "third-party", tool: "astro build" },
    {
      phrase: "Wrote dist/anand-francis-resume.pdf",
      kind: "source",
      script: "scripts/build-pdf.mjs",
    },
    { phrase: "Wrote dist/og.png", kind: "source", script: "scripts/build-og.mjs" },
    { phrase: "Finalized dist", kind: "source", script: "scripts/finalize-dist.mjs" },
    { phrase: "Wrote dist/_headers", kind: "source", script: "scripts/build-headers.mjs" },
    {
      phrase: "JavaScript budget: N B gzip of 30720 B.",
      kind: "source",
      script: "scripts/check-budget.mjs",
    },
    { phrase: "Result (N files):", kind: "third-party", tool: "astro check" },
    { phrase: "- 0 errors", kind: "third-party", tool: "astro check" },
    { phrase: "- 0 warnings", kind: "third-party", tool: "astro check" },
    { phrase: "- 0 hints", kind: "third-party", tool: "astro check" },
    {
      phrase: "Line endings: N text files, all LF.",
      kind: "live",
      command: ["scripts/check-eol.mjs"],
    },
    { phrase: "# fail 0", kind: "third-party", tool: "node --test" },
    { phrase: "All matched files use Prettier code style!", kind: "third-party", tool: "prettier" },
    {
      phrase: "Lighthouse: mobile and desktop at or above the floors",
      kind: "source",
      script: "scripts/lighthouse.mjs",
    },
    {
      phrase: "Skill eval: N prompts, N pass, N miss",
      kind: "source",
      script: "scripts/eval-skills.mjs",
    },
    {
      phrase: "Task eval: N tasks, N pass, N fail",
      kind: "source",
      script: "scripts/eval-tasks.mjs",
    },
    {
      phrase: "Expiry check: nearest expiry in N days",
      kind: "live",
      command: ["scripts/check-expiry.mjs"],
    },
    {
      // Not "live": the check asks the advisory database, and this suite stays offline.
      phrase: "Advisory check: N silenced, none patched",
      kind: "source",
      script: "scripts/check-advisories.mjs",
    },
    { phrase: "Rolled back preview to version", kind: "source", script: "scripts/rollback.mjs" },
    { phrase: "Preview on http://127.0.0.1:8788", kind: "source", script: "scripts/preview.mjs" },
  ];
  const known = new Map(table.map((row) => [row.phrase, row]));

  for (const phrase of quoted) {
    it(`"${phrase}" is classified in this test`, () => {
      assert.ok(known.has(phrase), `CLAUDE.md quotes "${phrase}", which this table does not know`);
    });
  }
  for (const row of table) {
    it(`"${row.phrase}" is still quoted in CLAUDE.md`, () => {
      assert.ok(
        quoted.has(row.phrase),
        `the table lists "${row.phrase}", which CLAUDE.md no longer quotes`,
      );
    });
  }

  /**
   * Does the phrase match the start of the literal? Fixed text must match exactly; a \`\${...}\`
   * gap stands for one run of non-space characters (a number, a file name, a hash); the phrase
   * may end anywhere, inside a gap or partway through fixed text, since CLAUDE.md quotes prefixes.
   */
  function phraseMatchesLiteral(phrase, literal) {
    const tokens = literal.split(/(\$\{[^}]*\})/).filter(Boolean);
    if (tokens.length === 0 || tokens[0].startsWith("${")) return false;
    const go = (pi, ti) => {
      if (pi >= phrase.length) return true;
      if (ti >= tokens.length) return false;
      const token = tokens[ti];
      if (token.startsWith("${")) {
        const run = /^\S+/.exec(phrase.slice(pi));
        if (!run) return false;
        for (let length = run[0].length; length >= 1; length -= 1) {
          if (go(pi + length, ti + 1)) return true;
        }
        return false;
      }
      const rest = phrase.slice(pi);
      if (rest.startsWith(token)) return go(pi + token.length, ti + 1);
      return token.startsWith(rest);
    };
    return go(0, 0);
  }
  /** The first string or template literal of every console.log and console.error call. */
  const literals = (source) =>
    [
      ...source.matchAll(
        /console\.(?:log|error)\(\s*(?:`((?:[^`\\]|\\.)*)`|"((?:[^"\\\n]|\\.)*)")/g,
      ),
    ].map((m) => m[1] ?? m[2]);

  // The matcher itself, so a change to it cannot quietly accept the wrong literal.
  const budget = "JavaScript budget: ${total} B gzip of ${LIMIT} B.";
  const pdf = "Wrote dist/${profile.resume.filename}: ${pages} page(s), ${size} KB.";
  for (const [phrase, literal, expected] of [
    ["JavaScript budget: 0 B gzip of 30720 B.", budget, true],
    ["JavaScript budget: 0 B gzipped of 99999 B.", budget, false],
    ["Wrote dist/anand-francis-resume.pdf", pdf, true],
    ["Wrote dist/", pdf, true],
    ["Finalized dist", "Finalized dist: résumé size ${size} in ${n} page(s).", true],
    ["Finalised dist", "Finalized dist: résumé size ${size} in ${n} page(s).", false],
    ["Zebra crossing", "${a}${b}", false],
    ["Zebra crossing", "", false],
  ]) {
    it(`matcher: "${phrase}" against "${literal}" is ${expected}`, () => {
      assert.equal(phraseMatchesLiteral(phrase, literal), expected);
    });
  }

  for (const row of table) {
    if (row.kind === "source") {
      it(`"${row.phrase}" is printed by ${row.script}`, () => {
        const phrase = row.phrase.replace(/\bN\b/g, "0");
        const found = literals(read(row.script)).some((lit) => phraseMatchesLiteral(phrase, lit));
        assert.ok(found, `${row.script} has no literal that prints "${row.phrase}"`);
      });
    }
    if (row.kind === "live") {
      it(`"${row.phrase}" is what ${row.command.join(" ")} prints`, () => {
        const result = spawnSync(process.execPath, row.command, {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
        });
        assert.equal(result.status, 0, result.stderr);
        const last = result.stdout.trim().split(/\r?\n/).pop();
        // CLAUDE.md quotes the start of a line; the rest may carry numbers and notes.
        const escaped = row.phrase.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
        const pattern = new RegExp(`^${escaped.replace(/\bN\b/g, "\\d+")}`);
        assert.match(last, pattern);
      });
    }
  }
});
