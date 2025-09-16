import { execSync } from "node:child_process";

const patterns = ['^<<<<<<<', '^=======$', '^>>>>>>>'];

try {
  const args = patterns.map((p) => `-e "${p}"`).join(' ');
  const out = execSync(
    `git grep -n ${args} -- . ":!node_modules" ":!.git"`,
    { stdio: "pipe" }
  ).toString().trim();

  if (out) {
    console.error("\n❌ Conflict markers found:\n" + out + "\n");
    process.exit(1);
  }

  console.log("✅ No conflict markers");
} catch (e) {
  if (e.status === 1) {
    console.log("✅ No conflict markers");
    process.exit(0);
  }

  console.error("check failed:", e.message);
  process.exit(2);
}
