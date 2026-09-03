// Rolls the preview or production Worker back to an earlier version: the mirror of deploy.mjs.
// Production needs RELEASE_APPROVAL in the environment, the approval reference (a ticket or the
// approving message); without it the script refuses, and the Claude Code hook refuses to run it
// at all. With no version id, wrangler rolls back to the version before the current one. The
// reference travels as wrangler's --message, and --yes accepts its confirmation, so it never
// prompts. Prints the deployment status afterwards and writes the active version id to
// GITHUB_OUTPUT when present.
//   node scripts/rollback.mjs --env preview [--version <id>]
//   RELEASE_APPROVAL=<reference> node scripts/rollback.mjs --env production [--version <id>]
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
// An option given with no value is an error, not an absence. Like the deploy guard, the last
// occurrence wins and both the spaced and the glued forms are read, so the two agree.
const MISSING = Symbol("missing");
const option = (long, short) => {
  let value;
  args.forEach((a, i) => {
    if (a === long || a === short) value = args[i + 1] ?? MISSING;
    const glued = new RegExp(`^(?:${long}|${short})=(.*)$`).exec(a);
    if (glued) value = glued[1] || MISSING;
  });
  return value;
};
const env = option("--env", "-e");
const version = option("--version", "-v");

if (env !== "preview" && env !== "production") {
  console.error("Usage: node scripts/rollback.mjs --env preview|production [--version <id>]");
  process.exit(1);
}
// wrangler passes the id to the API as given, so only a full version id works.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (version === MISSING || (version && !UUID.test(version))) {
  console.error("--version needs a full version id (the 36-character form wrangler lists).");
  process.exit(1);
}
// The reference is production's; a preview rollback never carries a stray one, and wrangler
// keeps a message to 120 characters and would read a leading dash as a flag.
const approval = env === "production" ? (process.env.RELEASE_APPROVAL?.trim() ?? "") : "";
if (approval.length > 120 || approval.startsWith("-")) {
  console.error("RELEASE_APPROVAL must be at most 120 characters and not begin with a dash.");
  process.exit(1);
}
if (env === "production" && !approval) {
  console.error(
    "Refusing to roll back production: RELEASE_APPROVAL is not set. Set it to the approval " +
      "reference (the release ticket or the approving message) and run again.",
  );
  process.exit(1);
}
const message = approval || `${env} rollback rehearsal`;

const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const run = (cliArgs) =>
  spawnSync(process.execPath, [wrangler, ...cliArgs], {
    cwd: root,
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf8",
    windowsHide: true,
  });

const started = Date.now();
const rollback = run([
  "rollback",
  ...(version ? [version] : []),
  "--env",
  env,
  "--message",
  message,
  "--yes",
]);
process.stdout.write(rollback.stdout ?? "");
if (rollback.status !== 0) process.exit(rollback.status ?? 1);

// The rollback itself names the version it deployed; the status that follows is a record,
// so a status that cannot be read does not turn a completed rollback into a failure.
const fromRollback = /Current Version ID:\s*([0-9a-f-]{36})/i.exec(rollback.stdout ?? "")?.[1];
const status = run(["deployments", "status", "--env", env]);
process.stdout.write(status.stdout ?? "");
const fromStatus = /Version\(s\):\s*\(\d+%\)\s*([0-9a-f-]{36})/i.exec(status.stdout ?? "")?.[1];
if (status.status !== 0)
  console.warn("The deployment status could not be read after the rollback.");
const active = fromStatus ?? fromRollback;
if (!active) {
  console.error("Neither the rollback nor the deployment status reported a version id.");
  process.exit(1);
}
const seconds = Math.round((Date.now() - started) / 1000);
console.log(`Rolled back ${env} to version ${active} in ${seconds} s.`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${active}\n`);
