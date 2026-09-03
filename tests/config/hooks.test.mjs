// The three hooks, spawned as Claude Code spawns them, against the payload tables in spec.md
// section 2.2: exit 0 is allowed, exit 2 is blocked with a message that starts "Blocked:". This
// file covers the behaviour the hooks have today; phase C adds the rows the spec marks "(new)".
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { edit, projectWithMarker, root, runHook, shell } from "./helpers.mjs";

const blocked = (result, label) => {
  assert.equal(
    result.status,
    2,
    `${label}: expected exit 2, got ${result.status}\n${result.stderr}`,
  );
  assert.match(result.stderr, /^Blocked:/, `${label}: the message names the block`);
};
const allowed = (result, label) =>
  assert.equal(
    result.status,
    0,
    `${label}: expected exit 0, got ${result.status}\n${result.stderr}`,
  );

describe("guard-deploy.mjs", () => {
  const cases = [
    ["wrangler deploy", "blocked"],
    ["wrangler deploy --env preview", "allowed"],
    ["wrangler deploy -e preview", "allowed"],
    ["wrangler deploy --env=preview", "allowed"],
    ["wrangler deploy --env production", "blocked"],
    ["wrangler versions upload", "allowed"],
    ["wrangler versions deploy", "blocked"],
    ["wrangler rollback", "blocked"],
    ["wrangler rollback --env production abc", "blocked"],
    ["wrangler rollback --env preview", "allowed"],
    ["wrangler delete", "blocked"],
    ["wrangler secret put X", "blocked"],
    ["wrangler triggers deploy", "blocked"],
    ["wrangler deploy --env preview && wrangler deploy", "blocked"],
    ["pnpm run deploy:production", "blocked"],
    ["pnpm run deploy:preview", "allowed"],
    ["node scripts/deploy.mjs --env production", "blocked"],
    ["node scripts/deploy.mjs --env preview", "allowed"],
    ["cat scripts/deploy.mjs", "allowed"],
    ["grep deploy scripts/deploy.mjs", "allowed"],
    ["RELEASE_APPROVAL=x wrangler deploy", "allowed"],
    ["", "allowed"],
  ];
  for (const tool of ["Bash", "PowerShell"]) {
    for (const [command, verdict] of cases) {
      it(`${tool}: ${command || "(empty command)"} is ${verdict}`, () => {
        const result = runHook("guard-deploy.mjs", shell(command, tool));
        (verdict === "blocked" ? blocked : allowed)(result, command);
      });
    }
  }
  it("allows wrangler deploy when RELEASE_APPROVAL is in the environment", () => {
    const result = runHook("guard-deploy.mjs", shell("wrangler deploy"), {
      env: { RELEASE_APPROVAL: "the approving message" },
    });
    allowed(result, "approval in the environment");
  });
  it("lists the offending segment and not the preview one", () => {
    const result = runHook(
      "guard-deploy.mjs",
      shell("wrangler deploy --env preview && wrangler deploy"),
    );
    blocked(result, "mixed segments");
    assert.match(result.stderr, /\n {2}wrangler deploy\n/);
    assert.doesNotMatch(result.stderr, /\n {2}wrangler deploy --env preview\n/);
  });
  it("ignores a payload that is not JSON", () => {
    allowed(runHook("guard-deploy.mjs", "not json"), "non-JSON payload");
  });
});

describe("guard-tests.mjs", () => {
  const protectedPaths = [
    "tests/e2e/a11y.spec.ts",
    "tests/config/hooks.test.mjs",
    "tests/pdf.spec.ts",
    "playwright.config.ts",
    "stylelint.config.js",
    ".htmlvalidate.json",
    "lighthouserc.cjs",
    "lighthouserc.desktop.cjs",
    ".github/workflows/ci.yml",
    "scripts/check-eol.mjs",
    "src/config/pairings.mjs",
  ];
  const openPaths = [
    "src/components/Header.astro",
    "scripts/build-pdf.mjs",
    "CLAUDE.md",
    "docs/sdlc/002-playbook-gaps/plan.md",
  ];
  const readOnlyCommands = [
    "cat tests/e2e/a11y.spec.ts",
    "grep -n hidden tests/e2e/*.ts",
    "node scripts/check-eol.mjs",
    "pnpm test",
    "git diff tests/",
    "sed 's/a/b/' tests/e2e/a11y.spec.ts",
    "echo x > /tmp/out.txt",
  ];
  const marker = projectWithMarker();
  after(() => rmSync(marker, { recursive: true, force: true }));
  const modes = [
    ["CLAUDE_TASK_MODE=fix", { env: { CLAUDE_TASK_MODE: "fix" } }],
    ["the marker file", { projectDir: marker }],
  ];

  for (const [mode, options] of modes) {
    describe(`in fix mode by ${mode}`, () => {
      for (const tool of ["Edit", "Write"]) {
        for (const rel of protectedPaths) {
          it(`${tool} on ${rel} is blocked`, () => {
            blocked(runHook("guard-tests.mjs", edit(resolve(root, rel), tool), options), rel);
          });
        }
        for (const rel of openPaths) {
          it(`${tool} on ${rel} is allowed`, () => {
            allowed(runHook("guard-tests.mjs", edit(resolve(root, rel), tool), options), rel);
          });
        }
      }
      it("blocks the same path written with forward slashes", () => {
        const forward = `${root.replace(/\\/g, "/")}/tests/e2e/theme.spec.ts`;
        blocked(runHook("guard-tests.mjs", edit(forward), options), forward);
      });
      for (const command of readOnlyCommands) {
        it(`Bash: ${command} is allowed`, () => {
          allowed(runHook("guard-tests.mjs", shell(command), options), command);
        });
      }
    });
  }

  describe("with fix mode off", () => {
    for (const rel of [...protectedPaths, ...openPaths]) {
      it(`Edit on ${rel} is allowed`, () => {
        allowed(runHook("guard-tests.mjs", edit(resolve(root, rel))), rel);
      });
    }
  });

  it("ignores a payload that is not JSON", () => {
    allowed(
      runHook("guard-tests.mjs", "not json", { env: { CLAUDE_TASK_MODE: "fix" } }),
      "non-JSON",
    );
  });
});

describe("format-on-edit.mjs", () => {
  const scratch = resolve(root, "tests/config/.tmp-format");
  after(() => rmSync(scratch, { recursive: true, force: true }));

  it("does nothing for a binary file", () => {
    const font = resolve(root, "src/assets/fonts/ibm-plex-sans-latin-400-normal.woff2");
    allowed(runHook("format-on-edit.mjs", edit(font)), "binary");
  });
  it("does nothing for a path outside the project", () => {
    allowed(runHook("format-on-edit.mjs", edit(join(tmpdir(), "outside.css"))), "outside");
  });
  it("reports a stylelint finding in a stylesheet with a raw colour", () => {
    mkdirSync(scratch, { recursive: true });
    const file = join(scratch, "raw.css");
    writeFileSync(file, ".x {\n  color: #123456;\n}\n");
    const result = runHook("format-on-edit.mjs", edit(file));
    assert.equal(result.status, 2, `expected exit 2, got ${result.status}\n${result.stderr}`);
    assert.match(result.stderr, /stylelint findings/);
  });
  it("formats a well-formed module and exits 0", () => {
    mkdirSync(scratch, { recursive: true });
    const file = join(scratch, "tidy.mjs");
    writeFileSync(file, "export const  a=1\n");
    allowed(runHook("format-on-edit.mjs", edit(file)), "module");
    assert.equal(readFileSync(file, "utf8"), "export const a = 1;\n");
  });
});
