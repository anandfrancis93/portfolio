// The build-time steps after astro build, in order, stopping at the first failure: the résumé
// PDF, the social card, the finalize pass (sentinel, _redirects, build-only pages), the headers
// file with the script hash, and the JavaScript budget. Each step is its own script; the
// renders, the headers step and the budget can be re-run alone, the finalize pass once per
// astro build.
//   node scripts/postbuild.mjs
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const steps = ["build-pdf", "build-og", "finalize-dist", "build-headers", "check-budget"];

for (const step of steps) {
  const result = spawnSync(process.execPath, [resolve(root, `scripts/${step}.mjs`)], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    console.error(`postbuild stopped at ${step} (exit ${result.status ?? "signal"}).`);
    process.exit(result.status ?? 1);
  }
}
