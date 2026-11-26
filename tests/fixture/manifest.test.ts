// Holds fixture/manifest.yaml to the fixture: its shape, and the `planted:` markers in both directions.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { FEATURE_AREAS } from "../../src/model/areas.ts";
import {
  isObjectKind,
  isRow,
  loadManifest,
  manifestEntries,
  OBJECT_FIELDS,
  OBJECT_KEYS,
  type Row,
} from "./manifest.ts";

const ENTRY_KEYS = [
  "id",
  "area",
  "kind",
  "description",
  "location",
  "sources",
  "note",
  "expected_rules",
  "pending",
  "oracle",
  "postgres_major",
];
const ORACLE_MODES = ["load-fails", "not-in-dump", "probe-same", "probe-differs"];
const HOSTS = ["supabase.com", "postgresql.org", "www.postgresql.org"];

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value !== "";

function sourceProblems(source: unknown): string[] {
  if (!isRow(source)) return ["a source is not a mapping"];
  const problems: string[] = [];
  let url: URL | undefined;
  try {
    url = new URL(String(source["url"]));
  } catch {
    problems.push("a source url does not parse");
  }
  if (url !== undefined) {
    const github = url.hostname === "github.com" && url.pathname.startsWith("/supabase/");
    if (url.protocol !== "https:" || !(github || HOSTS.includes(url.hostname))) {
      problems.push("a source is not on an accepted host");
    }
  }
  const read = source["read"];
  if (typeof read !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(read) || Number.isNaN(Date.parse(read))) {
    problems.push("a source read date is not YYYY-MM-DD");
  }
  return problems;
}

function databaseProblems(entry: Row, location: Row): string[] {
  const problems: string[] = [];
  const objects = location["database"];
  if (!Array.isArray(objects) || objects.length === 0) {
    return ["a database entry needs a non-empty location.database list"];
  }
  for (const object of objects as unknown[]) {
    if (!isRow(object) || !isObjectKind(object["object"])) {
      problems.push("a database object has an unknown kind");
      continue;
    }
    const kind = object["object"];
    for (const key of Object.keys(object)) {
      if (!(OBJECT_KEYS as readonly string[]).includes(key)) problems.push(`${kind}: unknown field ${key}`);
    }
    for (const field of OBJECT_FIELDS[kind]) {
      if (typeof object[field] !== "string") problems.push(`${kind}: missing field ${field}`);
    }
  }
  const oracle = entry["oracle"];
  if (!isRow(oracle) || !ORACLE_MODES.includes(String(oracle["mode"]))) {
    problems.push("a database entry needs an oracle with a valid mode");
  } else {
    const probed = String(oracle["mode"]).startsWith("probe-");
    if (probed !== nonEmpty(oracle["probe"])) problems.push("a probe belongs to probe-* modes only");
  }
  return problems;
}

function codeProblems(entry: Row, location: Row, id: string): string[] {
  const problems: string[] = [];
  if ("oracle" in entry) problems.push("a code entry has no oracle");
  const { file, symbol } = location;
  if (!nonEmpty(file) || !nonEmpty(symbol)) return [...problems, "a code entry needs file and symbol"];
  if (!existsSync(file)) return [...problems, "the code file does not exist"];
  const text = readFileSync(file, "utf8");
  if (!text.includes(`planted: ${id} (`)) problems.push("the code file does not carry the marker");
  if (!text.includes(symbol)) problems.push("the code file does not contain the symbol");
  return problems;
}

function entryProblems(entry: Row): string[] {
  const problems: string[] = [];
  const id = nonEmpty(entry["id"]) ? entry["id"] : "";
  if (!/^(db|code)\.[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) problems.push("the id is not db. or code. kebab-case");
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.includes(key)) problems.push(`unknown key ${key}`);
  }
  if (!(FEATURE_AREAS as readonly unknown[]).includes(entry["area"])) problems.push("unknown area");
  if (entry["kind"] !== "tie" && entry["kind"] !== "control") problems.push("kind is not tie or control");
  if (!nonEmpty(entry["description"])) problems.push("the description is empty");
  const sources = entry["sources"];
  if (!Array.isArray(sources)) problems.push("sources is not a list");
  else {
    for (const source of sources as unknown[]) problems.push(...sourceProblems(source));
    if (entry["kind"] === "tie" && sources.length === 0) problems.push("a tie needs a source");
  }
  const rules = entry["expected_rules"];
  if (!Array.isArray(rules) || !rules.every((rule) => typeof rule === "string")) {
    problems.push("expected_rules is not a list of strings");
  }
  if (typeof entry["pending"] !== "boolean") problems.push("pending is not a boolean");
  const location = entry["location"];
  if (!isRow(location)) return [...problems, "location is not a mapping"];
  if (id.startsWith("db.")) problems.push(...databaseProblems(entry, location));
  if (id.startsWith("code.")) problems.push(...codeProblems(entry, location, id));
  return problems.map((problem) => `${id}: ${problem}`);
}

function markers(): Map<string, string> {
  const found = new Map<string, string>();
  for (const name of readdirSync("fixture", { recursive: true, encoding: "utf8" })) {
    const path = `fixture/${name}`.replaceAll("\\", "/");
    if (path === "fixture/manifest.yaml" || path.includes("/node_modules/")) continue;
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue; // a directory
    }
    if (text.includes("\0")) continue;
    for (const match of text.matchAll(/planted: ([a-z0-9.-]+) \((tie|control)\)/g)) {
      const [, id = "", kind = ""] = match;
      expect(found.has(id), `marker ${id} appears more than once`).toBe(false);
      found.set(id, kind);
    }
    const loose = text.match(/planted:/g)?.length ?? 0;
    const strict = text.match(/planted: [a-z0-9.-]+ \((tie|control)\)/g)?.length ?? 0;
    expect(loose, `${path}: a planted: marker is not in the standard form`).toBe(strict);
  }
  return found;
}

describe("fixture/manifest.yaml", () => {
  const entries = manifestEntries();

  test("is version 1 with a list of entries", () => {
    expect(loadManifest()["manifest_version"]).toBe(1);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toHaveLength((loadManifest()["entries"] as unknown[]).length);
  });

  test("gives every entry a unique id", () => {
    const ids = entries.map((entry) => entry["id"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("holds each entry to the manifest format", () => {
    expect(entries.flatMap(entryProblems)).toEqual([]);
  });

  test("matches the planted markers under fixture/ in both directions", () => {
    const found = markers();
    const kinds = new Map(entries.map((entry) => [String(entry["id"]), String(entry["kind"])]));
    expect([...found].filter(([id]) => !kinds.has(id)).map(([id]) => id)).toEqual([]);
    expect([...kinds.keys()].filter((id) => !found.has(id))).toEqual([]);
    expect([...found].filter(([id, kind]) => kinds.get(id) !== kind).map(([id]) => id)).toEqual([]);
  });
});
