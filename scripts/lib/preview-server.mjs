// A wrangler preview of dist on 8788 for the tools that need the headers as the Worker serves
// them (Lighthouse). Reuses one that is already listening (the browser pane's, or Playwright's);
// otherwise starts `wrangler dev` and stops it afterwards, with its workerd child on Windows,
// where ending the parent alone leaves the child holding the port.
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const previewUrl = "http://127.0.0.1:8788";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function isUp(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/** Resolves to { url, started, stop } once the preview answers. */
export async function ensurePreview({ timeoutMs = 90_000 } = {}) {
  if (await isUp(previewUrl)) return { url: previewUrl, started: false, stop: async () => {} };

  const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  const child = spawn(process.execPath, [wrangler, "dev", "--port", "8788"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  const started = Date.now();
  while (!(await isUp(previewUrl))) {
    if (child.exitCode !== null)
      throw new Error(`wrangler dev exited early:\n${output.slice(-800)}`);
    if (Date.now() - started > timeoutMs) {
      child.kill();
      throw new Error(`wrangler dev did not answer within ${timeoutMs}ms:\n${output.slice(-800)}`);
    }
    await sleep(500);
  }

  const stop = () =>
    new Promise((done) => {
      if (child.exitCode !== null) {
        done();
        return;
      }
      child.once("exit", () => done());
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      } else {
        child.kill("SIGTERM");
      }
      setTimeout(done, 5000).unref();
    });

  return { url: previewUrl, started: true, stop };
}
