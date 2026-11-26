import { CODEOWNERS, checkGuidance } from "./checkers/guidance-integrity.ts";
import { listFiles, readJson, readText, report } from "./lib/repo.ts";

const paths = listFiles();
const texts = new Map<string, string>();
for (const path of paths) {
  if (path.endsWith(".md") || path === CODEOWNERS) {
    texts.set(path, readText(path));
  }
}

report(
  "check-guidance-integrity",
  checkGuidance({
    paths,
    texts,
    futurePaths: readJson("scripts/data/future-paths.json") as Record<string, string>,
    protectedPaths: readJson("scripts/data/protected-paths.json") as string[],
  }),
);
