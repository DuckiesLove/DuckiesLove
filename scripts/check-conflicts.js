import { spawnSync } from "node:child_process";

const args = [
  "grep",
  "-n",
  "-e",
  "^<<<<<<<",
  "-e",
  "^=======$",
  "-e",
  "^>>>>>>>",
  "--",
  ".",
  ":!node_modules",
  ":!.git",
];

const result = spawnSync("git", args, { encoding: "utf8" });

if (result.status === 0) {
  const output = result.stdout.trim();
  if (output) {
    console.error(`\n❌ Conflict markers found:\n${output}\n`);
    process.exit(1);
  }
  console.log("✅ No conflict markers");
  process.exit(0);
}

if (result.status === 1) {
  console.log("✅ No conflict markers");
  process.exit(0);
}

const message = result.stderr?.toString().trim() || result.error?.message || "Unknown error";
console.error(`check failed: ${message}`);
process.exit(result.status ?? 2);
