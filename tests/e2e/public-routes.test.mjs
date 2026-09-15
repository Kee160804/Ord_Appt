import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/+$/, "");

test(
  "deployed public metadata routes respond",
  { skip: !baseUrl },
  async () => {
    for (const path of [
      "/",
      "/manifest.webmanifest",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
      assert.ok(
        response.status >= 200 && response.status < 400,
        `${path}: ${response.status}`,
      );
    }
  },
);

test(
  "configured storefront resolves without a server error",
  { skip: !baseUrl || !process.env.E2E_STOREFRONT_SLUG },
  async () => {
    const slug = encodeURIComponent(process.env.E2E_STOREFRONT_SLUG);
    const response = await fetch(`${baseUrl}/store-front/${slug}`, {
      redirect: "manual",
    });
    assert.ok(response.status >= 200 && response.status < 400);
  },
);
