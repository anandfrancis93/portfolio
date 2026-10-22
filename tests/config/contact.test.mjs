// The contact address (spec 004 sections 2 and 3, plan 004 decisions 1 to 3): contactEmail
// gives the trimmed CONTACT_EMAIL or the stand-in; loadProfile refuses a profile that still
// holds identity.email and otherwise takes the address it is given; every caller of loadProfile
// passes contactEmail(), found by a search so a new caller is covered; findStandIn and the
// deploy script refuse a build that shows the stand-in; and only the two `pnpm build` steps of
// the deploy workflow receive the secret.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { parse as parseYaml } from "yaml";
import { contactEmail, STAND_IN } from "../../src/content/contact.ts";
import { loadProfile } from "../../src/content/profile.ts";
import { findStandIn } from "../../scripts/lib/stand-in.mjs";
import { read, root } from "./helpers.mjs";

const dir = mkdtempSync(join(tmpdir(), "portfolio-contact-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const source = read("src/content/profile.yaml");
const TEST_ADDRESS = "probe@example.org";

describe("contactEmail", () => {
  it("gives the stand-in when CONTACT_EMAIL is unset", () => {
    assert.equal(contactEmail({}), STAND_IN);
  });
  it("gives the stand-in when CONTACT_EMAIL is empty or blank", () => {
    assert.equal(contactEmail({ CONTACT_EMAIL: "" }), STAND_IN);
    assert.equal(contactEmail({ CONTACT_EMAIL: "  \t" }), STAND_IN);
  });
  it("gives the trimmed value when CONTACT_EMAIL is set", () => {
    assert.equal(contactEmail({ CONTACT_EMAIL: ` ${TEST_ADDRESS}\n` }), TEST_ADDRESS);
  });
  it("uses a reserved domain for the stand-in", () => {
    assert.match(STAND_IN, /@example\.com$/);
  });
});

describe("loadProfile and the address", () => {
  it("puts the address it is given at identity.email", () => {
    assert.equal(loadProfile(source, TEST_ADDRESS).identity.email, TEST_ADDRESS);
  });
  it("refuses a profile.yaml that still holds identity.email", () => {
    const withEmail = source.replace(/^(  location: .*)$/m, `$1\n  email: ${TEST_ADDRESS}`);
    assert.notEqual(withEmail, source);
    assert.throws(() => loadProfile(withEmail, TEST_ADDRESS), /identity\.email.*CONTACT_EMAIL/s);
  });
  it("still validates the address's shape", () => {
    assert.throws(() => loadProfile(source, "not an address"), /identity\.email/);
  });
  it("profile.yaml holds no identity.email", () => {
    assert.equal(Object.hasOwn(parseYaml(source).identity, "email"), false);
  });
});

describe("every caller of loadProfile passes contactEmail()", () => {
  const callers = execFileSync("git", ["grep", "-l", "loadProfile(", "--", "*.ts", "*.mjs"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    .filter((file) => file !== "src/content/profile.ts" && !file.startsWith("tests/config/"));

  it("finds the callers", () => assert.ok(callers.length >= 11, callers.join(", ")));
  for (const file of callers) {
    it(`${file} passes contactEmail() and imports it from contact.ts`, () => {
      const text = read(file);
      const calls = text.match(/loadProfile\(/g) ?? [];
      const passing = text.match(/loadProfile\([^;]*contactEmail\(\)[^;]*\)/g) ?? [];
      assert.equal(passing.length, calls.length, `${file} has a call without contactEmail()`);
      assert.match(text, /import \{ contactEmail \} from "[./]+(?:src\/content\/)?contact\.ts";/);
    });
  }
});

describe("the stand-in refusal", () => {
  const page = (body) => `<!doctype html><html><body>${body}</body></html>`;
  const build = (name, pages) => {
    const dist = join(dir, name, "dist");
    for (const [rel, body] of Object.entries(pages)) {
      mkdirSync(dirname(join(dist, rel)), { recursive: true });
      writeFileSync(join(dist, rel), body);
    }
    return dist;
  };

  it("finds nothing in a build that shows the real address", () => {
    const dist = build("real", {
      "index.html": page(TEST_ADDRESS),
      "404.html": page(TEST_ADDRESS),
    });
    assert.deepEqual(findStandIn(dist), []);
  });
  it("names every HTML file that shows the stand-in, nested ones too", () => {
    const dist = build("stand-in", {
      "index.html": page(STAND_IN),
      "404.html": page("nothing"),
      "nested/page.html": page(`mailto:${STAND_IN}`),
      "notes.txt": STAND_IN,
    });
    assert.deepEqual(findStandIn(dist), ["index.html", join("nested", "page.html")]);
  });

  it("stops deploy.mjs before wrangler runs", () => {
    // A copy of the script and the two modules it reads, beside a build with the stand-in and no
    // wrangler: the refusal must come first, so the output names CONTACT_EMAIL.
    const copy = join(dir, "deploy");
    for (const rel of [
      "scripts/deploy.mjs",
      "scripts/lib/stand-in.mjs",
      "src/content/contact.ts",
    ]) {
      mkdirSync(dirname(join(copy, rel)), { recursive: true });
      copyFileSync(resolve(root, rel), join(copy, rel));
    }
    mkdirSync(join(copy, "dist"), { recursive: true });
    writeFileSync(join(copy, "dist/index.html"), page(STAND_IN));
    writeFileSync(join(copy, "dist/_headers"), "");
    writeFileSync(join(copy, "dist/_redirects"), "");
    const result = spawnSync(
      process.execPath,
      [join(copy, "scripts/deploy.mjs"), "--env", "preview"],
      {
        cwd: copy,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to deploy: dist\/index\.html .*CONTACT_EMAIL/s);
    assert.doesNotMatch(result.stderr, /wrangler/i);
  });
});

describe("the deploy workflow gives CONTACT_EMAIL to the two build steps only", () => {
  const workflow = parseYaml(read(".github/workflows/deploy.yml"));
  const holders = [];
  for (const [job, spec] of Object.entries(workflow.jobs)) {
    assert.equal(Object.hasOwn(spec.env ?? {}, "CONTACT_EMAIL"), false, `${job} has it job-wide`);
    for (const step of spec.steps ?? []) {
      if (Object.hasOwn(step.env ?? {}, "CONTACT_EMAIL")) holders.push([job, step]);
    }
  }
  it("has no workflow-wide CONTACT_EMAIL", () => {
    assert.equal(Object.hasOwn(workflow.env ?? {}, "CONTACT_EMAIL"), false);
  });
  it("gives it to the pnpm build step of preview and of production, from the secret", () => {
    assert.deepEqual(
      holders.map(([job]) => job),
      ["preview", "production"],
    );
    for (const [job, step] of holders) {
      assert.equal(step.run, "pnpm build", `${job}'s holder is not the build step`);
      assert.equal(step.env.CONTACT_EMAIL, "${{ secrets.CONTACT_EMAIL }}");
    }
  });
  it("gives no other workflow the secret", () => {
    const others = readdirSync(resolve(root, ".github/workflows")).filter(
      (f) => f !== "deploy.yml",
    );
    assert.ok(others.length >= 4, others.join(", "));
    for (const file of others) {
      assert.doesNotMatch(read(`.github/workflows/${file}`), /CONTACT_EMAIL/, file);
    }
  });
});
