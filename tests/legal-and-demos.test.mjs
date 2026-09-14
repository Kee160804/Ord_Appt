import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public demos expose one tenant for each supported business type", async () => {
  const [home, mock] = await Promise.all([
    readFile("app/home/page.tsx", "utf8"),
    readFile("app/data/mock.ts", "utf8"),
  ]);

  for (const retained of [
    "Luxe Beauty Studio",
    "Ember & Oak Kitchen",
    "Maya Streetwear",
  ]) {
    assert.match(home, new RegExp(retained.replace(/[&]/g, "\\&")));
  }
  assert.doesNotMatch(home, /Iron Edge Barbershop|Blossom Bakehouse/);
  assert.match(
    mock,
    /ACTIVE_DEMO_TENANT_IDS = new Set\(\["apt-001", "ord-001", "ret-001"\]\)/,
  );
  assert.match(mock, /label: "Maya Streetwear"/);
});

test("legal policies are public and acceptance is versioned", async () => {
  const [privacy, terms, register, authService, sitemap, migration] =
    await Promise.all([
      readFile("app/privacy/page.tsx", "utf8"),
      readFile("app/terms/page.tsx", "utf8"),
      readFile("app/register/page.tsx", "utf8"),
      readFile("app/services/authService.ts", "utf8"),
      readFile("app/sitemap.ts", "utf8"),
      readFile(
        "supabase/migrations/202609140001_legal_acceptance_audit.sql",
        "utf8",
      ),
    ]);

  assert.match(privacy, /Payment information/);
  assert.match(privacy, /Your choices and rights/);
  assert.match(terms, /Customer orders and appointments/);
  assert.match(terms, /Payments and transaction records/);
  assert.match(register, /acceptedLegal/);
  assert.match(register, /Terms of Service/);
  assert.match(authService, /terms_accepted_at/);
  assert.match(authService, /privacy_version/);
  assert.match(sitemap, /\/privacy/);
  assert.match(sitemap, /\/terms/);
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS public\.legal_acceptances/,
  );
  assert.match(migration, /AFTER INSERT ON auth\.users/);
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.legal_acceptances FROM PUBLIC, anon, authenticated/,
  );
});
