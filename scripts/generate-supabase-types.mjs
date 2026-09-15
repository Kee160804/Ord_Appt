import { spawn } from "node:child_process";
import { rename, rm, writeFile } from "node:fs/promises";
import process from "node:process";

const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error(
    "SUPABASE_PROJECT_REF must be your 20-character project reference, not the example text. Find it in Supabase Dashboard > Project Settings > General.",
  );
  process.exit(1);
}
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (
  !accessToken ||
  accessToken === "your-access-token" ||
  accessToken.length < 20
) {
  console.error(
    "SUPABASE_ACCESS_TOKEN must be a real personal access token, not the example text. Create one from your Supabase account access-token settings.",
  );
  process.exit(1);
}

const cliArguments = [
  "--yes",
  "supabase@2",
  "gen",
  "types",
  "typescript",
  "--project-id",
  projectRef,
  "--schema",
  "public",
];

// Recent Node releases do not launch Windows .cmd shims directly. Invoke the
// npx shim through cmd.exe without enabling a general shell on other systems.
const isWindows = process.platform === "win32";
const executable = isWindows ? process.env.ComSpec || "cmd.exe" : "npx";
const argumentsForProcess = isWindows
  ? ["/d", "/s", "/c", "npx.cmd", ...cliArguments]
  : cliArguments;
const child = spawn(executable, argumentsForProcess, {
  env: process.env,
  stdio: ["ignore", "pipe", "inherit"],
  windowsHide: true,
});

let output = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  output += chunk;
});

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", resolve);
});
if (exitCode !== 0) {
  throw new Error(`Supabase type generation exited with code ${exitCode}.`);
}
if (!output.includes("export type Database")) {
  throw new Error("Supabase returned an unexpected type definition.");
}

const temporaryPath = "app/types/database.generated.ts.tmp";
const outputPath = "app/types/database.generated.ts";
try {
  await writeFile(temporaryPath, output, "utf8");
  await rename(temporaryPath, outputPath);
} finally {
  await rm(temporaryPath, { force: true });
}
console.log(`Generated ${outputPath}.`);
