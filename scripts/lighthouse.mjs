// Runs Lighthouse CI against the preview: mobile, then desktop, three runs each, the median
// against the spec's floors (lighthouserc.cjs and lighthouserc.desktop.cjs). A miss gets one
// automatic re-run before it fails, because Lighthouse varies run to run. Set LIGHTHOUSE_URL to
// audit a deployed preview instead of the local server.
//   node scripts/lighthouse.mjs   (after pnpm build)
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePreview } from "./lib/preview-server.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lhci = resolve(root, "node_modules/@lhci/cli/src/cli.js");
const configs = ["lighthouserc.cjs", "lighthouserc.desktop.cjs"];

const run = (config, url) =>
  spawnSync(process.execPath, [lhci, "autorun", `--config=${config}`], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, LIGHTHOUSE_URL: url },
  }).status === 0;

const external = process.env.LIGHTHOUSE_URL;
const server = external ? { url: external, stop: async () => {} } : await ensurePreview();
rmSync(resolve(root, ".lighthouseci"), { recursive: true, force: true });

let failed = false;
try {
  for (const config of configs) {
    let ok = run(config, server.url);
    if (!ok) {
      console.warn(`Lighthouse (${config}) missed a floor; one automatic re-run.`);
      ok = run(config, server.url);
    }
    if (!ok) failed = true;
  }
} finally {
  await server.stop();
}

if (failed) {
  console.error(
    "Lighthouse is below the spec's floors (section 10, gate 1). Reports: .lighthouseci/",
  );
  process.exit(1);
}
console.log("Lighthouse: mobile and desktop at or above the floors (median of three).");
