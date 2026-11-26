// Live: needs Docker and a started fixture (`npm run fixture:start`); run with NIGHTWELL_LIVE=1.
// The oracle, first half of the portability proof: dumps the fixture's non-managed schemas, loads them twice
// into throwaway stock PostgreSQL 17 containers statement by statement (`bare`, and `roles` where the roles
// the dump names are plain NOLOGIN stand-ins), and holds every database entry of fixture/manifest.yaml to its
// declared oracle mode (tests/fixture/oracle.ts). The fixture is only read: pg_dump and read-only probes.
// Output carries entry ids, modes, statuses, SQLSTATEs and counts, never an object name, a message or a probe
// row (R9, R10: the dump holds hostile names and canary values).
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { loadModule } from "libpg-query";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { manifestEntries } from "./manifest.ts";
import {
  BROKEN_PROBE_CODES,
  buildLoadScript,
  isManagedSchema,
  judge,
  oracleEntries,
  parseLoadOutput,
  PLATFORM_SCHEMAS,
  rolesOf,
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

// The cascades the oracle records without counting them as proof: an entry whose own statement fails only
// because an earlier object failed to load. Committed, so a new cascade is a decision, not a drift.
const EXPECTED_CASCADES: readonly string[] = [
  "db.bottles-generated-column",
  "db.bottles-quantity-check",
  "db.broadcast-changes-trigger",
  "db.cellars-is-public-column",
  "db.fk-indexes",
  "db.foreign-server-postgres-fdw",
  "db.matview-helper",
  "db.policy-auth-role",
  "db.policy-jwt-claim",
  "db.replica-identity-full",
  "db.rls-enabled",
  "db.rpc-search-bottles",
  "db.view-security-invoker",
  "db.webhook-trigger",
];

// A probe's outcome on one database: its rows as psql prints them, or the SQLSTATE it failed with.
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

const failureOf = (output: string, token: string): string | undefined =>
  new RegExp(`NW${token} err (\\S+)`).exec(output)?.[1];
const outcomeOf = (output: string, token: string): string => {
  const code = failureOf(output, token);
  return code === undefined ? `rows ${output}` : `err ${code}`;
};

async function startStock(name: string, image: string): Promise<void> {
  await ok("docker", [
    "run",
    "-d",
    "--name",
    name,
    "-e",
    `POSTGRES_PASSWORD=${randomBytes(16).toString("hex")}`,
    image,
  ]);
  for (let attempt = 0; ; attempt++) {
    const ready = await run("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
    if (ready.code === 0) break;
    if (attempt >= 60) throw new Error("the stock database did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  // The dump creates schema public itself; stock PostgreSQL ships an empty one.
  await ok("docker", ["exec", name, ...PSQL, "-c", "drop schema public"]);
}

describe.skipIf(process.env["NIGHTWELL_LIVE"] !== "1")("the oracle", () => {
  const token = randomBytes(8).toString("hex");
  // Two containers: roles are cluster-wide, so the `bare` pass must never see the stand-ins.
  const bareStock = `nightwell_oracle_bare_${token}`;
  const rolesStock = `nightwell_oracle_roles_${token}`;
  let entries: OracleEntry[] = [];
  let statements: Statement[] = [];
  let platformRoles: string[] = [];
  const empty: Judgement = { entries: [], unexplained: [], unattributed: [], platformAcl: [] };
  let bare: Judgement = empty;
  let roles: Judgement = empty;
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

    // The stock databases: the pinned image under its local tag, no published port, a throwaway password.
    const image = (
      await ok("bash", ["-c", ". scripts/fixture/lib.sh; pull_pinned STOCK_PG17 >&2; repo_tag STOCK_PG17"])
    ).trim();
    await startStock(bareStock, image);
    await startStock(rolesStock, image);

    // The roles the dump names that stock lacks, as plain NOLOGIN stand-ins in the `roles` container only.
    // Each name goes in as a psql variable, never into the SQL text.
    const present = new Set(
      (await ok("docker", ["exec", bareStock, ...PSQL, "-At", "-c", "select rolname from pg_roles"])).split("\n"),
    );
    platformRoles = rolesOf(statements).filter((name) => !present.has(name));
    for (const name of platformRoles) {
      await ok(
        "docker",
        ["exec", "-i", rolesStock, ...PSQL, "-v", "ON_ERROR_STOP=1", "-v", `role=${name}`, "-f", "-"],
        'create role :"role" nologin;\n',
      );
    }

    const load = async (container: string): Promise<Judgement> => {
      const loaded = await ok(
        "docker",
        ["exec", "-i", container, ...PSQL, "-q", "-f", "-"],
        buildLoadScript(statements, token),
      );
      const outcomes = parseLoadOutput(loaded, token, statements.length);
      return judge(
        statements.map((statement, index) => ({ statement, outcome: outcomes[index] ?? { ok: true } })),
        entries,
        platformRoles,
      );
    };
    bare = await load(bareStock);
    roles = await load(rolesStock);

    // The probes: on the fixture for every probe entry, on the `bare` stock database for those that loaded.
    reports = [];
    for (const entry of entries) {
      const inBare = bare.entries.find((one) => one.id === entry.id);
      const inRoles = roles.entries.find((one) => one.id === entry.id);
      if (inBare === undefined || inRoles === undefined) continue;
      let comparison: ProbeComparison | undefined;
      if (entry.mode.startsWith("probe-")) {
        const onFixture = await probe(FIXTURE, entry.probe, token);
        const code = failureOf(onFixture, token);
        if (code !== undefined && (entry.mode === "probe-same" || BROKEN_PROBE_CODES.has(code))) {
          brokenProbes.push(entry.id);
        }
        if (inBare.status === "loaded") {
          const onStock = await probe(bareStock, entry.probe, token);
          comparison = outcomeOf(onFixture, token) === outcomeOf(onStock, token) ? "same" : "differs";
        }
      }
      reports.push({
        id: entry.id,
        mode: entry.mode,
        status: inBare.status,
        sqlstates: inBare.sqlstates,
        verdict: verdictOf(entry, { bare: inBare, roles: inRoles }, comparison),
      });
    }
  }, 900_000);

  afterAll(async () => {
    await run("docker", ["rm", "-f", bareStock, rolesStock]);
  }, 60_000);

  test("splits the dump into statements", () => {
    expect(statements.length).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);
  });

  test("explains every failing statement in both passes", () => {
    expect(bare.unexplained).toEqual([]);
    expect(bare.unattributed).toEqual([]);
    expect(roles.unexplained).toEqual([]);
    expect(roles.unattributed).toEqual([]);
  });

  test("runs every probe on the fixture", () => {
    expect(brokenProbes).toEqual([]);
  });

  test("names, for every entry that fails to load, schemas or roles the dump holds", () => {
    const known = new Set([...PLATFORM_SCHEMAS, ...platformRoles]);
    const wrong = entries
      .filter((entry) => entry.mode === "load-fails")
      .filter((entry) => entry.failsOn.length === 0 || entry.failsOn.some((name) => !known.has(name)))
      .map((entry) => entry.id);
    expect(wrong).toEqual([]);
  });

  test("holds every database entry to its declared oracle mode", () => {
    const mismatches = reports
      .filter((report) => report.verdict === "mismatch")
      .map(({ id, mode, status, sqlstates }) => ({ id, mode, status, sqlstates }));
    expect(mismatches).toEqual([]);
  });

  test("records exactly the committed cascades", () => {
    const cascades = reports.filter((report) => report.verdict === "cascade").map((report) => report.id);
    expect([...cascades].sort()).toEqual([...EXPECTED_CASCADES].sort());
  });

  test("lists the platform's own grants apart, and the list is not empty", () => {
    expect(bare.platformAcl.length).toBeGreaterThan(0);
  });

  test("prints the summary", () => {
    for (const line of summarize(reports, bare.platformAcl)) console.info(line);
    expect(reports).toHaveLength(entries.length);
  });
});
