import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("service worker falls back only after network recovery attempts", async () => {
  const worker = await readFile("public/sw.js", "utf8");
  const registration = await readFile("components/PwaRegister.tsx", "utf8");

  assert.match(worker, /navigationPreload\.enable\(\)/);
  assert.match(worker, /cache: "reload"/);
  assert.match(worker, /request\.mode !== "navigate"/);
  assert.doesNotMatch(worker, /client\.navigate\(/);
  assert.match(registration, /process\.env\.NODE_ENV !== "production"/);
  assert.match(registration, /registration\.unregister\(\)/);
});

test("offline fallback can recover when the app server returns", async () => {
  const offline = await readFile("public/offline.html", "utf8");

  assert.match(offline, /navigator\.onLine/);
  assert.match(offline, /registration\?\.update\(\)/);
  assert.match(offline, /window\.addEventListener\("online"/);
  assert.match(offline, /location\.reload\(\)/);
});

test("installed mobile PWA exposes sign-in and storefront demo controls", async () => {
  const header = await readFile("app/components/PublicHeader.tsx", "utf8");
  const storefront = await readFile("app/components/store.tsx", "utf8");
  const styles = await readFile("app/styles/global.css", "utf8");

  assert.match(header, /pwa-public-actions/);
  assert.match(header, /href="\/login"/);
  assert.match(storefront, /pwa-demo-view-switcher/);
  assert.match(storefront, /> Storefront/);
  assert.match(
    styles,
    /@media \(display-mode: standalone\) and \(max-width: 639px\)/,
  );
  assert.match(
    styles,
    /\.pwa-combined-primary-cta\s*\{\s*display: none !important;/,
  );
});

test("registration keeps overflowing content clear of its actions", async () => {
  const registration = await readFile("app/register/page.tsx", "utf8");
  const styles = await readFile("app/styles/global.css", "utf8");

  assert.match(registration, /overflow-y-auto overscroll-contain/);
  assert.match(registration, /Enter your last name\./);
  assert.match(registration, /if \(step === 1\) \{\s*router\.push\("\/home"\)/);
  assert.match(registration, /onClick=\{goBack\}/);
  assert.doesNotMatch(
    registration,
    /role="alert"[\s\S]{0,250}className="fixed/,
  );
  assert.match(styles, /\.registration-shell input:-webkit-autofill/);
});
