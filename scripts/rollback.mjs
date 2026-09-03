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
const option = (long, short) => {
  const at = args.findIndex((a) => a === long || a === short);
  if (at >= 0) return args[at + 1];
  return args.find((a) => a.startsWith(`${long}=`))?.slice(long.length + 1);
};
const env = option("--env", "-e");
const version = option("--version", "-v");

if (env !== "preview" && env !== "production") {
  console.error("Usage: node scripts/rollback.mjs --env preview|production [--version <id>]");
  process.exit(1);
}
if (version && !/^[0-9a-f-]{8,}$/i.test(version)) {
  console.error(`"${version}" does not look like a version id.`);
  process.exit(1);
}
if (env === "production" && !process.env.RELEASE_APPROVAL) {
  console.error(
    "Refusing to roll back production: RELEASE_APPROVAL is not set. Set it to the approval " +
      "reference (the release ticket or the approving message) and run again.",
  );
  process.exit(1);
}
const message = process.env.RELEASE_APPROVAL ?? `${env} rollback rehearsal`;

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

const status = run(["deployments", "status", "--env", env]);
process.stdout.write(status.stdout ?? "");
if (status.status !== 0) process.exit(status.status ?? 1);

// wrangler prints the active version as "Version(s): (100%) <id>", the id a UUID.
const active = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
  status.stdout ?? "",
)?.[1];
if (!active) {
  console.error("The deployment status reported no version id.");
  process.exit(1);
}
const seconds = Math.round((Date.now() - started) / 1000);
console.log(`Rolled back ${env} to version ${active} in ${seconds} s.`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${active}\n`);
