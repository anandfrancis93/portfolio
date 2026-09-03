// The response headers as the Worker serves them (spec section 10, gate 7), against the local
// wrangler preview or, with PLAYWRIGHT_BASE_URL set, the deployed preview: the security headers
// on every page, the CSP with a hash and no unsafe-inline, HTML revalidated on every request,
// the résumé inline as a PDF on both paths without the CSP, immutable fingerprinted assets, the
// build-only pages gone, and the workers.dev hosts marked noindex.
import { expect, test } from "@playwright/test";
import { profile } from "../helpers/page.ts";

const pdfPaths = [profile.contact.resume.href, `/${profile.resume.filename}`];

test("every page carries the security headers and a hashed CSP", async ({ request }) => {
  for (const [path, status] of [
    ["/", 200],
    ["/nope", 404],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(status);
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";
    expect(csp, `${path} CSP`).toContain("default-src 'none'");
    expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toContain("preload");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) {
      expect(headers["permissions-policy"], feature).toContain(feature);
    }
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cache-control"], `${path} cache`).toMatch(/max-age=0|no-cache/);
  }
});

test("the résumé is served inline as a PDF on both paths, without the CSP", async ({ request }) => {
  for (const path of pdfPaths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    const headers = response.headers();
    expect(headers["content-type"]).toContain("application/pdf");
    expect(headers["content-disposition"]).toContain("inline");
    expect(headers["content-security-policy"]).toBeUndefined();
    expect(headers["x-frame-options"]).toBe("DENY");
    const body = await response.body();
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }
});

test("fingerprinted assets are immutable for a year", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const assets = [...html.matchAll(/(?:href|src)="(\/_astro\/[^"]+)"/g)].map((m) => m[1]);
  expect(assets.length).toBeGreaterThan(0);
  for (const path of new Set(assets)) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"]).toContain("immutable");
  }
});

test("the build-only pages and the social card are as the build left them", async ({ request }) => {
  for (const path of ["/resume-print/", "/og-card/"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  const card = await request.get("/og.png");
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/png");
});

test("workers.dev hosts are marked noindex; nothing else is", async ({ request, baseURL }) => {
  const response = await request.get("/");
  const tag = response.headers()["x-robots-tag"];
  if (new URL(baseURL ?? "").hostname.endsWith("workers.dev")) expect(tag).toContain("noindex");
  else expect(tag).toBeUndefined();
});
