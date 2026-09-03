// A wrangler preview of dist for the tools that need the headers as the Worker serves them
// (Lighthouse). The port is PREVIEW_PORT, default 8788, so two checkouts can preview side by
// side without one's tools reading the other's build. Reuses a preview already listening on
// that port (the browser pane's, or Playwright's); otherwise starts `wrangler dev` and stops it
// afterwards, with its workerd child on Windows, where ending the parent alone leaves the child
// holding the port.
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import port from "./preview-port.cjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The default and the parser live in preview-port.cjs, which the two configs load too. */
export const { DEFAULT_PORT, previewPort } = port;

export const previewUrl = `http://127.0.0.1:${previewPort()}`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function isUp(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/** Ends a wrangler dev process and, on Windows, the workerd child it leaves behind. */
export function stopPreview(child) {
  return new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) {
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
}

/** Starts `wrangler dev` on the preview port with the given stdio. */
export function startPreview(stdio = ["ignore", "pipe", "pipe"]) {
  const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  return spawn(process.execPath, [wrangler, "dev", "--port", String(previewPort())], {
    cwd: root,
    stdio,
    windowsHide: true,
  });
}

/** Resolves to { url, started, stop } once the preview answers. */
export async function ensurePreview({ timeoutMs = 90_000 } = {}) {
  if (await isUp(previewUrl)) return { url: previewUrl, started: false, stop: async () => {} };

  const child = startPreview();
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

  return { url: previewUrl, started: true, stop: () => stopPreview(child) };
}
