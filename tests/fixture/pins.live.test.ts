// Live: needs Docker and a started fixture (`npm run fixture:start`); run with NIGHTWELL_LIVE=1.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const run = promisify(execFile);
const docker = async (...args: string[]) => (await run("docker", args)).stdout.trim();

const pins = (): Map<string, { repo: string; tag: string }> =>
  new Map(
    [...readFileSync("fixture/versions.env", "utf8").matchAll(/^([A-Z0-9_]+)=([a-z0-9./-]+):([^@\s]+)@sha256:[0-9a-f]{64}$/gm)].map(
      ([, name = "", repo = "", tag = ""]) => [name, { repo, tag }],
    ),
  );

describe.skipIf(process.env["NIGHTWELL_LIVE"] !== "1")("the running fixture", () => {
  test("uses the pinned PostgreSQL 17 image", async () => {
    const line = /^PG17_DB=(.+)@sha256:[0-9a-f]{64}$/m.exec(
      readFileSync("fixture/versions.env", "utf8"),
    );
    expect(line).not.toBeNull();
    const pinned = await docker("image", "inspect", "--format", "{{.Id}}", line?.[1] ?? "");
    const running = await docker("inspect", "--format", "{{.Image}}", "supabase_db_cellarbook");
    expect(running).toBe(pinned);
  });

  // The CLI starts containers by tag, and some run once and exit before any check of the running
  // containers: a CLI bump that moves a tag must fail here instead of pulling an unpinned image.
  test.each([
    [17, ["PG17_DB", "AUTH", "REALTIME", "STORAGE", "POOLER"]],
    [15, ["PG15_DB", "AUTH", "REALTIME", "STORAGE", "POOLER"]],
  ] as const)("the locked CLI's local image tags for PostgreSQL %i are the pinned ones", async (major, names) => {
    const { stdout } = await run("node_modules/.bin/supabase", ["services", "--workdir", "fixture", "--output-format", "json"], {
      env: { ...process.env, SUPABASE_DB_MAJOR_VERSION: String(major) },
    });
    const services = (JSON.parse(stdout) as { services: { name: string; local: string }[] }).services;
    const reported = new Map(services.map((service) => [service.name, service.local]));
    const pinned = pins();
    for (const name of names) {
      const pin = pinned.get(name);
      expect(pin, `${name} is pinned`).toBeDefined();
      expect(reported.get(pin?.repo ?? ""), `${name} tag`).toBe(pin?.tag);
    }
  });
});
