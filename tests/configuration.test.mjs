import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("canonical market configuration is consistent", async () => {
  const platform = await readFile("app/lib/platform.ts", "utf8");
  const readme = await readFile("README.md", "utf8");
  assert.match(platform, /name: "YuhBusiness"/);
  assert.match(platform, /currency: "BZD"/);
  assert.match(platform, /locale: "en-BZ"/);
  assert.match(platform, /timezone: "America\/Belize"/);
  assert.match(readme, /^# YuhBusiness/m);
  assert.doesNotMatch(readme, /LocalSpace/);
});

test("large operational lists use bounded database ranges", async () => {
  for (const path of [
    "app/services/orderService.ts",
    "app/services/appointmentService.ts",
    "app/services/customerService.ts",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /\.range\(from, from \+ safePageSize - 1\)/, path);
    assert.match(source, /Math\.min\(500,/, path);
  }
});
