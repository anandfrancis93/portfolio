// How the build reads the contact address (plan 004 decision 1): an `astro build` with
// CONTACT_EMAIL set writes that address into the pages and not the stand-in, so the prerender
// reads the same process environment as the scripts and the tests. One build into a throwaway
// folder; the repository's dist is untouched.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { STAND_IN } from "../../src/content/contact.ts";
import { root } from "./helpers.mjs";

const TEST_ADDRESS = "probe@example.org";
const out = mkdtempSync(join(tmpdir(), "portfolio-contact-build-"));
after(() => rmSync(out, { recursive: true, force: true }));

describe("astro build reads CONTACT_EMAIL", () => {
  it("writes the address, not the stand-in, into the pages", { timeout: 240_000 }, async () => {
    const astro = resolve(root, "node_modules/astro/bin/astro.mjs");
    await new Promise((done, fail) => {
      execFile(
        process.execPath,
        [astro, "build", "--outDir", out, "--silent"],
        {
          cwd: root,
          env: { ...process.env, CONTACT_EMAIL: TEST_ADDRESS, ASTRO_TELEMETRY_DISABLED: "1" },
          maxBuffer: 16 * 1024 * 1024,
        },
        (error, stdout, stderr) =>
          error ? fail(new Error(`${error.message}\n${stderr}`)) : done(),
      );
    });
    for (const page of ["index.html", "404.html"]) {
      const html = readFileSync(join(out, page), "utf8");
      assert.ok(html.includes(`mailto:${TEST_ADDRESS}`), `${page} lacks the address`);
      assert.equal(html.includes(STAND_IN), false, `${page} shows the stand-in`);
    }
  });
});
