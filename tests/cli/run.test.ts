import { expect, test } from "vitest";
import { supportsNode } from "../../bin/node-range.js";
import { EXIT_OK, EXIT_USAGE, readVersion, run } from "../../src/cli/run.ts";

function capture(argv: string[]) {
  let out = "";
  let err = "";
  const code = run(argv, { out: (t) => (out += t), err: (t) => (err += t) });
  return { code, out, err };
}

test("prints the version on standard output", () => {
  expect(capture(["--version"])).toEqual({ code: EXIT_OK, out: `${readVersion()}\n`, err: "" });
});

test("prints help with no arguments and with --help", () => {
  expect(capture([]).out).toMatch(/^Usage: nightwell/);
  expect(capture(["-h"])).toMatchObject({ code: EXIT_OK, err: "" });
});

test("rejects an unknown flag or command with the usage exit code", () => {
  expect(capture(["--nope"])).toMatchObject({ code: EXIT_USAGE, out: "" });
  const unknown = capture(["audit"]);
  expect(unknown.code).toBe(EXIT_USAGE);
  expect(unknown.err).toContain("unknown command 'audit'");
});

test("the binary's Node range check follows engines.node", () => {
  const range = "^22.12.0 || ^24.0.0 || ^26.0.0";
  expect(["22.12.0", "22.23.5", "24.0.0", "26.3.1"].map((v) => supportsNode(range, v))).toEqual([
    true,
    true,
    true,
    true,
  ]);
  expect(["20.19.0", "22.11.9", "23.1.0", "27.0.0"].some((v) => supportsNode(range, v))).toBe(
    false,
  );
});
