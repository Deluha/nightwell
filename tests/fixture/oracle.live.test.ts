// Live: needs Docker and a started fixture (`npm run fixture:start`); run with NIGHTWELL_LIVE=1.
// The oracle, first half of the portability proof: dumps the fixture's non-managed schemas, loads them into
// a throwaway stock PostgreSQL 17 container statement by statement, and holds every database entry of
// fixture/manifest.yaml to its declared oracle mode (tests/fixture/oracle.ts). The fixture is only read:
// pg_dump and read-only probes. Output carries entry ids, modes, statuses, SQLSTATEs and counts, never an
// object name, a message or a probe row (R9, R10: the dump holds hostile names and canary values).
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { loadModule } from "libpg-query";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { manifestEntries } from "./manifest.ts";
import {
  buildLoadScript,
  isManagedSchema,
  judge,
  oracleEntries,
  parseLoadOutput,
  splitDump,
  summarize,
  verdictOf,
  type EntryReport,
  type Judgement,
  type OracleEntry,
  type ProbeComparison,
  type Statement,
} from "./oracle.ts";

const FIXTURE = "supabase_db_cellarbook";
const READ_ONLY = "PGOPTIONS=-c default_transaction_read_only=on";
const PSQL = ["psql", "-U", "postgres", "-d", "postgres", "-X"];

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], input = ""): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

async function ok(command: string, args: string[], input = ""): Promise<string> {
  const result = await run(command, args, input);
  // stderr can carry object names from the dump, so it is not part of the message
  if (result.code !== 0) throw new Error(`${command} ${args[0] ?? ""} exited with ${String(result.code)}`);
  return result.stdout;
}

// A probe's result on one database: its rows as psql prints them, or the SQLSTATE it failed with.
async function probe(container: string, sql: string, token: string): Promise<string> {
  const script = `${sql};\n\\if :ERROR\n\\echo NW${token} err :LAST_ERROR_SQLSTATE\n\\endif\n`;
  const result = await run(
    "docker",
    ["exec", "-i", "-e", READ_ONLY, container, ...PSQL, "-At", "-f", "-"],
    script,
  );
  if (result.code !== 0) throw new Error("a probe could not run");
  return result.stdout;
}

const failedProbe = (output: string, token: string): boolean => output.includes(`NW${token} err `);

describe.skipIf(process.env["NIGHTWELL_LIVE"] !== "1")("the oracle", () => {
  const token = randomBytes(8).toString("hex");
  const stock = `nightwell_oracle_${token}`;
  let entries: OracleEntry[] = [];
  let statements: Statement[] = [];
  let judgement: Judgement = { entries: [], unexplained: [], unattributed: [] };
  let reports: EntryReport[] = [];
  const brokenProbes: string[] = [];

  beforeAll(async () => {
    await loadModule();
    entries = oracleEntries(manifestEntries().filter((entry) => String(entry["id"]).startsWith("db.")));

    // The dump: every schema of the fixture that is not managed.
    const names = (
      await ok("docker", ["exec", FIXTURE, ...PSQL, "-At", "-c", "select nspname from pg_namespace order by 1"])
    )
      .split("\n")
      .filter((name) => name !== "" && !isManagedSchema(name));
    const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
    const dump = await ok("docker", [
      "exec",
      FIXTURE,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--column-inserts",
      ...names.flatMap((name) => ["-n", quote(name)]),
    ]);
    statements = splitDump(dump);

    // The stock database: the pinned image under its local tag, no published port, a throwaway password.
    const image = (
      await ok("bash", ["-c", ". scripts/fixture/lib.sh; pull_pinned STOCK_PG17 >&2; repo_tag STOCK_PG17"])
    ).trim();
    await ok("docker", [
      "run",
      "-d",
      "--name",
      stock,
      "-e",
      `POSTGRES_PASSWORD=${randomBytes(16).toString("hex")}`,
      image,
    ]);
    for (let attempt = 0; ; attempt++) {
      const ready = await run("docker", ["exec", stock, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
      if (ready.code === 0) break;
      if (attempt >= 60) throw new Error("the stock database did not become ready");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    // The dump creates schema public itself; stock PostgreSQL ships an empty one.
    await ok("docker", ["exec", stock, ...PSQL, "-c", "drop schema public"]);

    const loaded = await ok(
      "docker",
      ["exec", "-i", stock, ...PSQL, "-q", "-f", "-"],
      buildLoadScript(statements, token),
    );
    const outcomes = parseLoadOutput(loaded, token, statements.length);
    judgement = judge(
      statements.map((statement, index) => ({ statement, outcome: outcomes[index] ?? { ok: true } })),
      entries,
    );

    // The probes: on the fixture for every probe entry, on the stock database for those that loaded.
    reports = [];
    for (const entry of entries) {
      const found = judgement.entries.find((one) => one.id === entry.id);
      if (found === undefined) continue;
      let comparison: ProbeComparison | undefined;
      if (entry.mode.startsWith("probe-")) {
        const onFixture = await probe(FIXTURE, entry.probe, token);
        if (failedProbe(onFixture, token)) brokenProbes.push(entry.id);
        if (found.status === "loaded") {
          const onStock = await probe(stock, entry.probe, token);
          comparison = failedProbe(onStock, token) ? "failed" : onFixture === onStock ? "same" : "differs";
        }
      }
      reports.push({
        id: entry.id,
        mode: entry.mode,
        status: found.status,
        sqlstates: found.sqlstates,
        verdict: verdictOf(entry, found.status, comparison),
      });
    }
  }, 600_000);

  afterAll(async () => {
    await run("docker", ["rm", "-f", stock]);
  }, 60_000);

  test("splits the dump into statements", () => {
    expect(statements.length).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);
  });

  test("explains every failing statement", () => {
    expect(judgement.unexplained).toEqual([]);
    expect(judgement.unattributed).toEqual([]);
  });

  test("runs every probe on the fixture", () => {
    expect(brokenProbes).toEqual([]);
  });

  test("holds every database entry to its declared oracle mode", () => {
    const mismatches = reports
      .filter((report) => report.verdict === "mismatch")
      .map(({ id, mode, status, sqlstates }) => ({ id, mode, status, sqlstates }));
    expect(mismatches).toEqual([]);
  });

  test("prints the summary", () => {
    for (const line of summarize(reports)) console.info(line);
    expect(reports).toHaveLength(entries.length);
  });
});
