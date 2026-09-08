// The two settings that keep wrangler from reporting on this project, read from the files so an
// edit cannot drop either in silence: the pair at the top level of `wrangler.jsonc`, where
// wrangler reads them for every environment, and the variable in the two workflows that run a
// wrangler command, which answers for what a project's configuration cannot reach. The rest of
// `wrangler.jsonc`, the shape the release path depends on, is not pinned here; that is worth its
// own change rather than this one's coat-tails. The file is JSONC, which `JSON.parse` refuses,
// so the comments and trailing commas are stripped here by a scan that knows what a string is;
// a parser that did not would trip over the first `//` inside one.
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

describe("the workflows that run wrangler", () => {
  // The config answers for every command that has read it; the environment answers for the
  // autoconfig events wrangler dispatches before it has. Both are needed for a runner to
  // report nothing, so both are pinned.
  for (const file of [".github/workflows/ci.yml", ".github/workflows/deploy.yml"]) {
    it(`${file} sets WRANGLER_SEND_METRICS false for every job`, () => {
      const workflow = parse(read(file));
      assert.equal(workflow.env?.WRANGLER_SEND_METRICS, "false");
    });
  }
  it("the watch workflow runs no wrangler command, so it needs neither", () => {
    const watch = parse(read(".github/workflows/watch.yml"));
    const commands = JSON.stringify(watch.jobs);
    assert.ok(!/wrangler|pnpm (run )?(deploy|preview|rollback)/.test(commands));
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
