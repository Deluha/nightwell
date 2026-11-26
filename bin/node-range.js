// Tells whether a Node.js version satisfies a range written as caret ranges
// joined by "||" (the form of engines.node in package.json). Kept free of
// syntax newer than ES2015 modules, because it runs before the version check.
export function supportsNode(range, version) {
  var current = version.split(".").map(Number);
  return range.split("||").some(function (part) {
    var min = part.trim().replace(/^\^/, "").split(".").map(Number);
    if (current[0] !== min[0]) return false;
    if (current[1] !== min[1]) return current[1] > min[1];
    return current[2] >= min[2];
  });
}
