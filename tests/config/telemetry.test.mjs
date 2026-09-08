// What the toolchain reports about this project, read from the files so an edit cannot drop any
// of it in silence: wrangler's two settings at the top level of `wrangler.jsonc`, where wrangler
// reads them for every environment, and the two variables in the two workflows that run the
// toolchain, which answer for what a project's configuration cannot reach. Wrangler dispatches
// some events before it reads the configuration; astro has no project-file switch at all, so for
// astro the environment and a machine-level opt-out are the only two levers and the environment
// is the one a repository can hold. The rest of `wrangler.jsonc`, the shape the release path
// depends on, is not pinned here; that is worth its own change. `wrangler.jsonc` is JSONC, which
// `JSON.parse` refuses, so the comments and trailing commas are stripped here by a scan that
// knows what a string is; a parser that did not would trip over the first `//` inside one.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse } from "yaml";
import { read } from "./helpers.mjs";

/** JSONC to JSON: line and block comments and trailing commas dropped, strings left alone. */
export function stripJsonc(text) {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let at = 0; at < text.length; at += 1) {
    const c = text[at];
    const next = text[at + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        at += 1;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        at += 1;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      inLine = true;
      at += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlock = true;
      at += 1;
      continue;
    }
    out += c;
  }
  // A comma before a closing brace or bracket, with only whitespace between.
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const text = read("wrangler.jsonc");
const config = JSON.parse(stripJsonc(text));

describe("wrangler.jsonc: what wrangler reports about this project", () => {
  it("sends no usage telemetry and no dependency inventory", () => {
    assert.equal(config.send_metrics, false);
    assert.deepEqual(config.dependencies_instrumentation, { enabled: false });
  });
  it("keeps both at the top level, the only place wrangler reads them", () => {
    // Neither key exists on an environment in wrangler's schema, so a copy inside `env` would
    // be silently ignored and the top-level one is what every `--env` run reads.
    for (const [name, environment] of Object.entries(config.env ?? {})) {
      assert.equal(environment.send_metrics, undefined, `env.${name} carries send_metrics`);
      assert.equal(
        environment.dependencies_instrumentation,
        undefined,
        `env.${name} carries dependencies_instrumentation`,
      );
    }
  });
});

/** A command that would run wrangler or astro, named in a workflow's steps. */
const RUNS_THE_TOOLCHAIN =
  /\b(wrangler|astro)\b|pnpm (run )?(build|check|dev|deploy|preview|rollback|test|verify|lighthouse)(?![\w:-])/;

describe("the workflows that run the toolchain", () => {
  // Wrangler's config answers for every command that has read it; the environment answers for
  // the autoconfig events it dispatches before it has, and for astro, which has no project
  // file to read. A runner reports nothing only with both, so both are pinned. The list is
  // every workflow that can reach either tool: `ci` and `deploy` run the build, and `claude`
  // may run it when a fix needs it. `review` runs neither, and `watch` is asserted below.
  for (const file of [
    ".github/workflows/ci.yml",
    ".github/workflows/deploy.yml",
    ".github/workflows/claude.yml",
  ]) {
    it(`${file} silences wrangler and astro for every job`, () => {
      const workflow = parse(read(file));
      // The two values differ on purpose: wrangler reads this one as a boolean, astro reads
      // only whether its own is set, so `"1"` is a convention here and not a magic value.
      assert.equal(workflow.env?.WRANGLER_SEND_METRICS, "false", `${file} misses the wrangler one`);
      assert.equal(workflow.env?.ASTRO_TELEMETRY_DISABLED, "1", `${file} misses the astro one`);
    });
  }
  it("the watch workflow runs neither tool, so it needs neither variable", () => {
    // If this fails, the watch has gained a step that runs the toolchain: give that workflow
    // the same two variables and add it to the list above, rather than loosening this.
    // `pnpm check-expiry` and `pnpm check-advisories` are deliberately not matched: they are
    // this workflow's own node scripts, which run neither tool.
    const watch = parse(read(".github/workflows/watch.yml"));
    const commands = JSON.stringify(watch.jobs);
    const match = RUNS_THE_TOOLCHAIN.exec(commands);
    assert.equal(match, null, `watch.yml appears to run the toolchain: ${match?.[0]}`);
  });
  it("the guard recognises a toolchain command and lets the watch's own scripts through", () => {
    for (const yes of ["pnpm build", "pnpm verify", "pnpm test", "wrangler dev", "astro build"]) {
      assert.ok(RUNS_THE_TOOLCHAIN.test(yes), yes);
    }
    for (const no of [
      "node scripts/check-expiry.mjs",
      "pnpm check-expiry",
      "pnpm check-advisories",
      "a catastrophic failure",
      "gh issue comment",
    ]) {
      assert.ok(!RUNS_THE_TOOLCHAIN.test(no), no);
    }
  });
});

describe("the JSONC scan the tests above rest on", () => {
  it("drops comments and trailing commas, and never touches a string", () => {
    const source = `{
      // a line comment with a "quote" and a // inside it
      "a": "http://example.test//not-a-comment", /* a block comment */
      "b": [1, 2,],
      "c": "a \\" quoted quote // still a string",
    }`;
    assert.deepEqual(JSON.parse(stripJsonc(source)), {
      a: "http://example.test//not-a-comment",
      b: [1, 2],
      c: 'a " quoted quote // still a string',
    });
  });
});
