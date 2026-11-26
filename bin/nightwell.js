#!/usr/bin/env node
// Checks the Node.js version before loading the CLI, so an unsupported runtime
// gets a clear message instead of a syntax error.
import { createRequire } from "node:module";
import process from "node:process";
import { supportsNode } from "./node-range.js";

var range = createRequire(import.meta.url)("../package.json").engines.node;

if (supportsNode(range, process.versions.node)) {
  import("../dist/cli/main.js");
} else {
  process.stderr.write(
    "nightwell: Node.js " + process.versions.node + " is not supported (needs " + range + ").\n",
  );
  process.exitCode = 2;
}
