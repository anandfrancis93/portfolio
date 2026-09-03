// Deploys the built site to the preview Worker or, with a release authorization, to
// production. Production needs RELEASE_APPROVAL in the environment, the approval reference
// (a ticket or the approving message); without it the script refuses, and the Claude Code
// hook refuses to run it at all. Prints the URL the deploy reports and writes it to
// GITHUB_OUTPUT when present, for the workflow to comment and test against.
//   node scripts/deploy.mjs --env preview
//   RELEASE_APPROVAL=<reference> node scripts/deploy.mjs --env production
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const envIndex = args.findIndex((a) => a === "--env" || a === "-e");
const env = envIndex >= 0 ? args[envIndex + 1] : args.find((a) => a.startsWith("--env="))?.slice(6);

if (env !== "preview" && env !== "production") {
  console.error("Usage: node scripts/deploy.mjs --env preview|production");
  process.exit(1);
}
if (env === "production" && !process.env.RELEASE_APPROVAL) {
  console.error(
    "Refusing to deploy production: RELEASE_APPROVAL is not set. Set it to the approval reference " +
      "(the release ticket or the approving message) and run again.",
  );
  process.exit(1);
}
for (const required of ["dist/index.html", "dist/_headers", "dist/_redirects"]) {
  if (!existsSync(resolve(root, required))) {
    console.error(`${required} is missing: run pnpm build first.`);
    process.exit(1);
  }
}

const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const result = spawnSync(process.execPath, [wrangler, "deploy", "--env", env], {
  cwd: root,
  stdio: ["inherit", "pipe", "inherit"],
  encoding: "utf8",
  windowsHide: true,
});
process.stdout.write(result.stdout ?? "");
if (result.status !== 0) process.exit(result.status ?? 1);

// wrangler prints the deployed hosts, one per line, after the upload summary.
const url =
  /https:\/\/[a-z0-9.-]+\.workers\.dev\b/i.exec(result.stdout ?? "")?.[0] ??
  (env === "production" ? "https://anandfrancis.com" : null);
if (!url) {
  console.error("The deploy reported no URL.");
  process.exit(1);
}
console.log(`Deployed ${env}: ${url}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
