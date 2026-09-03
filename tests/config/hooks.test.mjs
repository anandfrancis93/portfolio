// The three hooks, spawned as Claude Code spawns them, against the payload tables in spec.md
// section 2.2: exit 0 is allowed, exit 2 is blocked with a message that starts "Blocked:". This
// file covers every row, the ones phase C added included: the shell-side guard, the wider
// perimeter, and the deploy guard's knowledge of the rollback script.
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { edit, root, runHook, scratchProject, shell } from "./helpers.mjs";

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
    ["grep deploy scripts/rollback.mjs", "allowed"],
    ["pnpm run rollback:production", "blocked"],
    ["pnpm run rollback:preview", "allowed"],
    ["node scripts/rollback.mjs --env production", "blocked"],
    ["node scripts/rollback.mjs --env preview", "allowed"],
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
    // The perimeter phase C added: what decides the definition of done, this guard, and the marker.
    "package.json",
    ".claude/settings.json",
    ".claude/hooks/guard-tests.mjs",
    ".claude/hooks/lib/command.mjs",
    "REVIEW.md",
    ".claude/FIX_TASK",
    ".github/expiry.json",
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
    "grep hidden tests/e2e/a11y.spec.ts > /tmp/out.txt",
    "git checkout main",
    "git diff -- tests/",
    "ls .claude/hooks",
    "cat .claude/FIX_TASK",
    "git checkout main",
    "git stash list",
    "pnpm install",
    "find tests -name '*.ts'",
    "cd src && rm -rf .astro",
  ];
  const readOnlyPowerShell = [
    "Get-Content package.json",
    "Get-ChildItem tests",
    "Select-String hidden tests/e2e/a11y.spec.ts",
  ];
  // Shell forms that write, move or delete a protected path, on either shell tool.
  const writingCommands = [
    ["Bash", "sed -i 's/a/b/' tests/e2e/a11y.spec.ts"],
    ["Bash", "sed --in-place 's/a/b/' scripts/check-eol.mjs"],
    ["Bash", "echo x > tests/e2e/new.spec.ts"],
    ["Bash", "printf x >> package.json"],
    ["Bash", "cat > tests/x.mjs <<EOF"],
    ["Bash", "tee tests/e2e/a11y.spec.ts"],
    ["Bash", "cp a.ts tests/e2e/a11y.spec.ts"],
    ["Bash", "mv x playwright.config.ts"],
    ["Bash", "rm .claude/FIX_TASK"],
    ["Bash", "rm -rf tests/config"],
    ["Bash", "git checkout -- tests/"],
    ["Bash", "git restore tests/e2e/a11y.spec.ts"],
    ["Bash", "cat tests/e2e/a11y.spec.ts && rm .claude/FIX_TASK"],
    ["Bash", "node -e \"require('fs').writeFileSync('tests/x.mjs', '')\""],
    ["PowerShell", "Set-Content tests/e2e/a11y.spec.ts x"],
    ["PowerShell", "Remove-Item .claude/FIX_TASK"],
    ["PowerShell", "Out-File package.json"],
    ["PowerShell", "Get-Content x | Out-File -FilePath .github/workflows/ci.yml"],
    // Forms pass 1 of the phase C review found the first cut missed.
    ["Bash", "rm -rf tests"],
    ["Bash", "rm -rf .claude"],
    ["Bash", "rm -rf .github"],
    ["Bash", "rm -rf .claude/hooks"],
    ["Bash", "git restore ."],
    ["Bash", "git checkout -- ."],
    ["Bash", "git reset --hard"],
    ["Bash", "git stash"],
    ["Bash", "rm .claude/fix_task"],
    ["Bash", "rm .claude//FIX_TASK"],
    ["Bash", "rm ./.claude/./FIX_TASK"],
    ["Bash", "git checkout tests/e2e/a11y.spec.ts"],
    ["Bash", "git checkout HEAD~1 tests/e2e/a11y.spec.ts"],
    ["Bash", "git mv tests/e2e/a11y.spec.ts tests/e2e/b.spec.ts"],
    ["Bash", "echo x>tests/e2e/new.spec.ts"],
    ["Bash", "echo x &> tests/e2e/new.spec.ts"],
    ["Bash", "sed -ni 's/a/b/' tests/e2e/a11y.spec.ts"],
    ["Bash", "sed -Ei 's/a/b/' scripts/check-eol.mjs"],
    ["Bash", "cd .claude && rm FIX_TASK"],
    ["Bash", "cd tests && rm -rf e2e"],
    ["Bash", "cd tests; cd e2e; rm a11y.spec.ts"],
    ["Bash", 'bash -c "rm .claude/FIX_TASK"'],
    ["Bash", "sh -c 'echo x > package.json'"],
    ["Bash", 'powershell -Command "Remove-Item .claude/FIX_TASK"'],
    ["Bash", 'eval "rm .claude/FIX_TASK"'],
    ["Bash", "find .claude -name FIX_TASK -delete"],
    ["Bash", "find tests -name '*.ts' -exec rm {} +"],
    ["Bash", "echo .claude/FIX_TASK | xargs rm"],
    ["Bash", "/bin/rm .claude/FIX_TASK"],
    ["Bash", "\\rm .claude/FIX_TASK"],
    ["Bash", "sudo rm .claude/FIX_TASK"],
    ["Bash", "pnpm pkg set scripts.verify=echo"],
    ["Bash", "pnpm add left-pad"],
    ["Bash", "prettier --write tests/e2e/a11y.spec.ts"],
    ["Bash", "node -e \"require('fs').createWriteStream('tests/x.mjs')\""],
    ["Bash", "python -c \"open('package.json','w').write('')\""],
    ["PowerShell", "ri .claude/FIX_TASK"],
    ["PowerShell", "New-Item -Force package.json"],
    ["PowerShell", "Rename-Item REVIEW.md x"],
    ["PowerShell", "sc tests/e2e/a11y.spec.ts x"],
    // The remaining forms spec section 6 lists.
    ["Bash", "truncate -s 0 tests/e2e/a11y.spec.ts"],
    ["Bash", "git rm tests/e2e/a11y.spec.ts"],
    ["Bash", "git clean -fd tests"],
    ["Bash", "node --eval \"require('fs').writeFileSync('package.json', '')\""],
    ["PowerShell", "Add-Content REVIEW.md x"],
    ["PowerShell", "Move-Item tests/e2e/a11y.spec.ts x"],
    ["PowerShell", "Copy-Item x playwright.config.ts"],
    ["PowerShell", "Clear-Content .github/workflows/ci.yml"],
  ];
  // Both verdicts come from throwaway projects, so the repository's own marker, which exists
  // during a real fix task, never decides a test.
  const marker = scratchProject({ marker: true });
  const plain = scratchProject({ marker: false });
  after(() => {
    for (const dir of [marker, plain]) rmSync(dir, { recursive: true, force: true });
  });
  const modes = [
    // The environment form also runs from a throwaway project: the marker rule asks git and gh
    // whether the branch has a pull request, and the repository's own branch may have one.
    ["CLAUDE_TASK_MODE=fix", { env: { CLAUDE_TASK_MODE: "fix" }, projectDir: plain }],
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
      for (const command of readOnlyPowerShell) {
        it(`PowerShell: ${command} is allowed`, () => {
          allowed(runHook("guard-tests.mjs", shell(command, "PowerShell"), options), command);
        });
      }
      for (const [tool, command] of writingCommands) {
        it(`${tool}: ${command} is blocked`, () => {
          const result = runHook("guard-tests.mjs", shell(command, tool), options);
          blocked(result, command);
          assert.match(result.stderr, /writes to/, "the message names the write");
        });
      }
    });
  }

  // The marker rule, both verdicts, under a fake gh on PATH. Node resolves a command on Windows
  // only as .exe or .com, so the fake runs where the runner is Linux, which CI is.
  describe(
    "the marker rule",
    { skip: process.platform === "win32" && "needs a shell script on PATH" },
    () => {
      const repo = (prAnswer) => {
        const dir = scratchProject({ marker: true });
        const git = (...args) =>
          spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
            cwd: dir,
            encoding: "utf8",
          });
        git("init", "-q", "-b", "fix/one");
        git("commit", "--allow-empty", "-q", "-m", "init");
        mkdirSync(join(dir, "bin"));
        writeFileSync(join(dir, "bin", "gh"), `#!/bin/sh\necho '${prAnswer}'\n`, { mode: 0o755 });
        return dir;
      };
      const withPr = repo('[{"number": 1}]');
      const withoutPr = repo("[]");
      after(() => {
        for (const dir of [withPr, withoutPr]) rmSync(dir, { recursive: true, force: true });
      });
      const env = (dir) => ({ PATH: `${join(dir, "bin")}:${process.env.PATH}` });

      it("allows deleting the marker on its own once gh finds an open pull request", () => {
        const options = { projectDir: withPr, env: env(withPr) };
        allowed(runHook("guard-tests.mjs", shell("rm .claude/FIX_TASK"), options), "with a PR");
        allowed(
          runHook("guard-tests.mjs", shell("Remove-Item .claude/FIX_TASK", "PowerShell"), options),
          "with a PR, PowerShell",
        );
      });
      it("refuses deleting the marker while gh finds none", () => {
        const options = { projectDir: withoutPr, env: env(withoutPr) };
        blocked(runHook("guard-tests.mjs", shell("rm .claude/FIX_TASK"), options), "without a PR");
      });
      it("refuses a delete that names the marker and another protected path, PR or not", () => {
        const options = { projectDir: withPr, env: env(withPr) };
        for (const command of [
          "rm .claude/FIX_TASK tests/e2e/a11y.spec.ts",
          "mv .claude/FIX_TASK package.json",
          "cp .claude/FIX_TASK .claude/settings.json",
          "echo x .claude/FIX_TASK > tests/e2e/new.spec.ts",
        ]) {
          blocked(runHook("guard-tests.mjs", shell(command), options), command);
        }
      });
    },
  );

  describe("with fix mode off", () => {
    const off = { projectDir: plain };
    for (const tool of ["Edit", "Write"]) {
      for (const rel of [...protectedPaths, ...openPaths]) {
        it(`${tool} on ${rel} is allowed`, () => {
          allowed(runHook("guard-tests.mjs", edit(resolve(root, rel), tool), off), rel);
        });
      }
    }
    for (const [tool, command] of [
      ...readOnlyCommands.map((c) => ["Bash", c]),
      ...writingCommands,
    ]) {
      it(`${tool}: ${command} is allowed`, () => {
        allowed(runHook("guard-tests.mjs", shell(command, tool), off), command);
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
  // A throwaway project outside the repository that shares this checkout's node_modules through
  // a link and carries copies of the two formatter configs, so the hook runs the real Prettier
  // and stylelint and nothing is ever written inside the tree, where a concurrent Prettier scan
  // would see it.
  const project = mkdtempSync(join(tmpdir(), "portfolio-format-"));
  symlinkSync(resolve(root, "node_modules"), join(project, "node_modules"), "junction");
  writeFileSync(join(project, "package.json"), '{ "type": "module" }\n');
  for (const config of [".prettierrc.json", "stylelint.config.js"]) {
    copyFileSync(resolve(root, config), join(project, config));
  }
  after(() => {
    unlinkSync(join(project, "node_modules"));
    rmSync(project, { recursive: true, force: true });
  });

  it("does nothing for a binary file", () => {
    // The spec names a .png; the repository tracks no .png, so a font file stands in.
    const font = resolve(root, "src/assets/fonts/ibm-plex-sans-latin-400-normal.woff2");
    allowed(runHook("format-on-edit.mjs", edit(font)), "binary");
  });
  it("leaves a file outside the project untouched", () => {
    const file = join(project, "outside.mjs");
    writeFileSync(file, "export const  a=1\n");
    allowed(runHook("format-on-edit.mjs", edit(file)), "outside");
    assert.equal(readFileSync(file, "utf8"), "export const  a=1\n", "the file was formatted");
  });
  it("reports a stylelint finding in a stylesheet with a raw colour", () => {
    const file = join(project, "raw.css");
    writeFileSync(file, ".x {\n  color: #123456;\n}\n");
    const result = runHook("format-on-edit.mjs", edit(file), { projectDir: project });
    assert.equal(result.status, 2, `expected exit 2, got ${result.status}\n${result.stderr}`);
    assert.match(result.stderr, /stylelint findings/);
  });
  it("formats a well-formed module and exits 0", () => {
    const file = join(project, "tidy.mjs");
    writeFileSync(file, "export const  a=1\n");
    allowed(runHook("format-on-edit.mjs", edit(file), { projectDir: project }), "module");
    assert.equal(readFileSync(file, "utf8"), "export const a = 1;\n");
  });
});
