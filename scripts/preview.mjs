// Serves dist through `wrangler dev`, as the Worker will, with _headers, _redirects and the 404
// handling applied, on PREVIEW_PORT (default 8788). A second checkout sets its own port, so its
// tests and Lighthouse never read this one's build. Ends wrangler's workerd child on Windows
// when the process is interrupted, where ending the parent alone leaves the child on the port.
//   pnpm preview                       http://127.0.0.1:8788
//   PREVIEW_PORT=8790 pnpm preview     http://127.0.0.1:8790
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { previewPort, startPreview, stopPreview } from "./lib/preview-server.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(resolve(root, "dist/index.html"))) {
  console.error("dist/index.html is missing: run pnpm build first.");
  process.exit(1);
}

console.log(`Preview on http://127.0.0.1:${previewPort()} (PREVIEW_PORT to change it).`);
const child = startPreview("inherit");
// An interrupt ends the child on purpose, so its exit code (1 under taskkill) is not ours.
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    stopping = true;
    await stopPreview(child);
    process.exit(0);
  });
}
child.on("exit", (code) => process.exit(stopping ? 0 : (code ?? 0)));
