/**
 * Matches a POSIX-style relative path against a simple glob: `*` matches within
 * one segment, `**` matches any number of segments, a trailing `/` matches
 * everything below a directory.
 */
export function matchesGlob(path: string, glob: string): boolean {
  const segments = (glob.endsWith("/") ? `${glob}**` : glob).split("/");
  let source = "";
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === "**") {
      source += last ? ".*" : "(?:[^/]+/)*";
    } else {
      source += segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
      if (!last) source += "/";
    }
  });
  return new RegExp(`^${source}$`).test(path);
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}
