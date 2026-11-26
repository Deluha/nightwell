// The image pins and the canary credentials each have one home; this test keeps their copies honest.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("fixture/versions.env", () => {
  const lines = read("fixture/versions.env")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));

  test("holds only pinned references", () => {
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z0-9_]+=[a-z0-9./-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$/);
    }
  });

  test("names each pin once", () => {
    const names = lines.map((line) => line.split("=")[0]);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("fixture/canaries.json", () => {
  const file = JSON.parse(read("fixture/canaries.json")) as {
    canaries_version: number;
    canaries: { id: string; value: string; scanner_match?: string }[];
  };

  test("is versioned and gives each canary a unique id", () => {
    expect(file.canaries_version).toBe(1);
    const ids = file.canaries.map((canary) => canary.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("is allow-listed in .gitleaks.toml by exact value, and nothing else is", () => {
    const toml = read(".gitleaks.toml");
    const block = /\[\[allowlists\]\][\s\S]*?regexes\s*=\s*\[([\s\S]*?)\]/.exec(toml);
    expect(block).not.toBeNull();
    const listed = [...(block?.[1] ?? "").matchAll(/'''(.*?)'''/g)].map((match) => match[1]);
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // The scanner allow-lists what its rule matched, which for a connection string is only the part up to the host.
    const expected = file.canaries.map((canary) => `^${escape(canary.scanner_match ?? canary.value)}$`);
    expect([...listed].sort()).toEqual([...expected].sort());
  });
});
