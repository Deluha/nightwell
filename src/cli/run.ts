import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

export const EXIT_OK = 0;
export const EXIT_USAGE = 2;

const HELP = `Usage: nightwell [options]

Audits a Supabase project and reports its ties to the Supabase platform.
No command is available yet; this build prints its version and this help.

Options:
  -h, --help     Show this help
  -V, --version  Show the version
`;

export function readVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  return (manifest as { version: string }).version;
}

/** Runs the CLI on the given arguments and returns the exit code. */
export function run(argv: readonly string[], io: Io): number {
  let values: { help?: boolean; version?: boolean };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: [...argv],
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "V" },
      },
      allowPositionals: true,
    }));
  } catch (error) {
    io.err(`nightwell: ${error instanceof Error ? error.message : "invalid arguments"}\n`);
    io.err("Run 'nightwell --help' for usage.\n");
    return EXIT_USAGE;
  }

  if (values.version) {
    io.out(`${readVersion()}\n`);
    return EXIT_OK;
  }
  const command = positionals[0];
  if (command !== undefined) {
    io.err(`nightwell: unknown command '${command}'\n`);
    io.err("Run 'nightwell --help' for usage.\n");
    return EXIT_USAGE;
  }
  io.out(HELP);
  return EXIT_OK;
}
