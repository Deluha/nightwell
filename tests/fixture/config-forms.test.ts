// fixture/config-forms/config.json is fixture/supabase/config.jsonc without its comments; this keeps them equal.
import { readFileSync } from "node:fs";
import { parseExpression } from "@babel/parser";
import type { Expression } from "@babel/types";
import { expect, test } from "vitest";

// Evaluates the literal subset JSONC allows: objects, arrays, strings, numbers, booleans, null.
const evaluate = (node: Expression): unknown => {
  switch (node.type) {
    case "ObjectExpression":
      return Object.fromEntries(
        node.properties.map((property) => {
          if (property.type !== "ObjectProperty" || property.key.type !== "StringLiteral") {
            throw new Error(`unexpected property ${property.type}`);
          }
          return [property.key.value, evaluate(property.value as Expression)];
        }),
      );
    case "ArrayExpression":
      return node.elements.map((element) => evaluate(element as Expression));
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return node.value;
    case "NullLiteral":
      return null;
    default:
      throw new Error(`unexpected ${node.type}`);
  }
};

test("config.json equals config.jsonc", () => {
  const jsonc = evaluate(parseExpression(readFileSync("fixture/supabase/config.jsonc", "utf8")));
  const json: unknown = JSON.parse(readFileSync("fixture/config-forms/config.json", "utf8"));
  expect(json).toEqual(jsonc);
});
