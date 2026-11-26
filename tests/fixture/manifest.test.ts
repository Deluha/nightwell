// Holds fixture/manifest.yaml to the fixture: its shape, and the `planted:` markers in both directions.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { FEATURE_AREAS } from "../../src/model/areas.ts";
import {
  isObjectKind,
  isOracleMode,
  isRow,
  loadManifest,
  manifestEntries,
  OBJECT_FIELDS,
  OBJECT_KEYS,
  ORACLE_KEYS,
  type Row,
} from "./manifest.ts";
import { identifiersIn } from "./oracle.ts";

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
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value !== "";

// The accepted source hosts: supabase.com and postgresql.org only under /docs, and github.com/supabase
// only at a pinned commit (/blob/<40 hex>/ or /tree/<40 hex>/).
function acceptedSource(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const parts = url.pathname.split("/");
  switch (url.hostname) {
    case "supabase.com":
    case "postgresql.org":
    case "www.postgresql.org":
      return parts[1] === "docs";
    case "github.com":
      return parts[1] === "supabase" && ["blob", "tree"].includes(parts[3] ?? "") && /^[0-9a-f]{40}$/.test(parts[4] ?? "");
    default:
      return false;
  }
}

function sourceProblems(source: unknown): string[] {
  if (!isRow(source)) return ["a source is not a mapping"];
  const problems: string[] = [];
  let url: URL | undefined;
  try {
    url = new URL(String(source["url"]));
  } catch {
    problems.push("a source url does not parse");
  }
  if (url !== undefined && !acceptedSource(url)) problems.push("a source is not on an accepted host and path");
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
  if (!isRow(oracle) || !isOracleMode(oracle["mode"])) {
    problems.push("a database entry needs an oracle with a valid mode");
  } else {
    problems.push(...oracleProblems(oracle, oracle["mode"], (objects as unknown[]).filter(isRow)));
  }
  return problems;
}

// The names that identify a location object in a probe: its own name, or its table.
const identifyingNames = (objects: Row[]): string[] =>
  objects.flatMap((object) => [object["name"], object["table"]].filter(nonEmpty));

// A probe split into its code, with string literals blanked out, and the exact text of each literal.
function probeTokens(sql: string): { code: string; literals: Set<string> } {
  const literals = new Set<string>();
  let code = "";
  for (let at = 0; at < sql.length; at++) {
    if (sql.charAt(at) !== "'") {
      code += sql.charAt(at);
      continue;
    }
    let text = "";
    for (at++; at < sql.length; at++) {
      if (sql.charAt(at) !== "'") text += sql.charAt(at);
      else if (sql.charAt(at + 1) === "'") text += sql.charAt(++at);
      else break;
    }
    literals.add(text);
    code += " ";
  }
  return { code, literals };
}

function oracleProblems(oracle: Row, mode: string, objects: Row[]): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(oracle)) {
    if (!(ORACLE_KEYS as readonly string[]).includes(key)) problems.push(`oracle: unknown field ${key}`);
  }
  const probed = mode.startsWith("probe-");
  if (probed !== nonEmpty(oracle["probe"])) problems.push("a probe belongs to probe-* modes only");
  if (probed && nonEmpty(oracle["probe"])) {
    const { code, literals } = probeTokens(oracle["probe"]);
    const named = identifiersIn(code);
    // An identifier in the code, or a string literal that is exactly the name; a name inside a longer
    // literal does not count.
    if (!identifyingNames(objects).some((name) => named.has(name) || literals.has(name))) {
      problems.push("the probe names none of the entry's own objects");
    }
  }
  const failsOn = oracle["fails_on"];
  if (mode === "load-fails") {
    if (!Array.isArray(failsOn) || failsOn.length === 0 || !failsOn.every(nonEmpty) || new Set(failsOn).size !== failsOn.length) {
      problems.push("a load-fails entry needs fails_on: a list of distinct platform schema and role names");
    }
  } else if ("fails_on" in oracle) problems.push("fails_on belongs to load-fails only");
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

  test("accepts sources only on the accepted hosts and paths", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const accepted = [
      `https://github.com/supabase/supabase/blob/${sha}/apps/docs/a.mdx`,
      `https://github.com/supabase/auth/tree/${sha}/migrations`,
      "https://supabase.com/docs/guides/auth",
      "https://www.postgresql.org/docs/17/postgres-fdw.html",
      "https://postgresql.org/docs/current/sql-grant.html",
    ];
    const refused = [
      "https://supabase.com/blog/post",
      "https://supabase.com/",
      "https://github.com/supabase/supabase/blob/main/README.md",
      `https://github.com/supabase/supabase/blob/${sha.slice(1)}/a.md`,
      `https://github.com/supabase/supabase/raw/${sha}/a.md`,
      `https://github.com/other/repo/blob/${sha}/a.md`,
      "https://www.postgresql.org/about/news",
      "https://postgresql.org/",
      "https://docs.supabase.com/docs/x",
      `http://github.com/supabase/supabase/blob/${sha}/a.md`,
    ];
    expect(accepted.filter((url) => !acceptedSource(new URL(url)))).toEqual([]);
    expect(refused.filter((url) => acceptedSource(new URL(url)))).toEqual([]);
  });

  test("flags a probe that names none of its entry's objects, and a misplaced or missing fails_on", () => {
    const objects = [{ object: "function", schema: "public", name: "add_bottle", args: "" }];
    expect(oracleProblems({ mode: "probe-differs", probe: "select public.add_bottle(1)" }, "probe-differs", objects)).toEqual([]);
    expect(oracleProblems({ mode: "probe-differs", probe: "select to_regprocedure('auth.uid()')" }, "probe-differs", objects)).toEqual([
      "the probe names none of the entry's own objects",
    ]);
    expect(oracleProblems({ mode: "probe-same", probe: "select add_bottle_x(1)" }, "probe-same", objects)).toHaveLength(1);
    // a name inside a longer string literal does not count; a literal that is exactly the name does
    const inside = oracleProblems({ mode: "probe-same", probe: "select 'call add_bottle now'" }, "probe-same", objects);
    expect(inside).toEqual(["the probe names none of the entry's own objects"]);
    expect(oracleProblems({ mode: "probe-same", probe: "select 1 where x = 'add_bottle'" }, "probe-same", objects)).toEqual([]);
    expect(oracleProblems({ mode: "probe-same", probe: 'select "add_bottle"' }, "probe-same", objects)).toEqual([]);
    expect(oracleProblems({ mode: "load-fails", fails_on: ["auth"] }, "load-fails", objects)).toEqual([]);
    expect(oracleProblems({ mode: "load-fails" }, "load-fails", objects)).toHaveLength(1);
    expect(oracleProblems({ mode: "load-fails", fails_on: [] }, "load-fails", objects)).toHaveLength(1);
    expect(oracleProblems({ mode: "load-fails", fails_on: ["auth", "auth"] }, "load-fails", objects)).toHaveLength(1);
    expect(oracleProblems({ mode: "not-in-dump", fails_on: ["auth"] }, "not-in-dump", objects)).toHaveLength(1);
  });

  test("holds each entry to the manifest format", () => {
    expect(entries.flatMap(entryProblems)).toEqual([]);
  });

  test("keeps every database object in ties only or in controls only", () => {
    const kinds = new Map<string, { ties: string[]; controls: string[] }>();
    for (const entry of entries.filter((one) => String(one["id"]).startsWith("db."))) {
      const location = entry["location"];
      const objects = isRow(location) && Array.isArray(location["database"]) ? location["database"] : [];
      for (const object of objects.filter(isRow)) {
        const key = JSON.stringify(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
        const seen = kinds.get(key) ?? { ties: [], controls: [] };
        seen[entry["kind"] === "tie" ? "ties" : "controls"].push(String(entry["id"]));
        kinds.set(key, seen);
      }
    }
    const both = [...kinds.values()].filter((seen) => seen.ties.length > 0 && seen.controls.length > 0);
    expect(both).toEqual([]);
  });

  test("matches the planted markers under fixture/ in both directions", () => {
    const found = markers();
    const kinds = new Map(entries.map((entry) => [String(entry["id"]), String(entry["kind"])]));
    expect([...found].filter(([id]) => !kinds.has(id)).map(([id]) => id)).toEqual([]);
    expect([...kinds.keys()].filter((id) => !found.has(id))).toEqual([]);
    expect([...found].filter(([id, kind]) => kinds.get(id) !== kind).map(([id]) => id)).toEqual([]);
  });
});
