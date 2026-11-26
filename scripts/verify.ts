// Runs every gate, never stops at the first failure, and prints one table.
import { spawnSync } from "node:child_process";

interface Step {
  name: string;
  args: string[];
}

const steps: Step[] = [
  { name: "check-conventions", args: ["scripts/check-conventions.ts"] },
  { name: "check-guidance-integrity", args: ["scripts/check-guidance-integrity.ts"] },
  { name: "check-docs-sync", args: ["scripts/check-docs-sync.ts"] },
  { name: "lint", args: ["node_modules/eslint/bin/eslint.js", "."] },
  { name: "format", args: ["node_modules/prettier/bin/prettier.cjs", "--check", "."] },
  { name: "type-check", args: ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"] },
  { name: "offline tests", args: ["node_modules/vitest/vitest.mjs", "run"] },
];

const results = steps.map((step) => {
  const started = Date.now();
  const run = spawnSync(process.execPath, step.args, { encoding: "utf8" });
  const passed = run.status === 0;
  if (!passed) {
    console.error(`\n── ${step.name} ──\n${run.stdout}${run.stderr}`);
  }
  return { name: step.name, passed, seconds: (Date.now() - started) / 1000 };
});

const width = Math.max(...results.map((result) => result.name.length));
console.log("");
for (const result of results) {
  const status = result.passed ? "pass" : "FAIL";
  console.log(`${result.name.padEnd(width)}  ${status}  ${result.seconds.toFixed(1)}s`);
}
const failed = results.filter((result) => !result.passed).length;
console.log(failed === 0 ? "\nverify: all gates pass" : `\nverify: ${failed} gate(s) failed`);
process.exitCode = failed === 0 ? 0 : 1;
