// Live: needs Docker and a started fixture (`npm run fixture:start`); run with NIGHTWELL_LIVE=1.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const run = promisify(execFile);
const docker = async (...args: string[]) => (await run("docker", args)).stdout.trim();

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
});
