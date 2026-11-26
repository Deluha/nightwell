import net from "node:net";
import { expect, test } from "vitest";

test("the offline harness blocks outgoing connections", async () => {
  expect(() => net.connect(5432, "127.0.0.1")).toThrow(/network connections are blocked/);
  await expect(fetch("http://127.0.0.1:9/")).rejects.toThrow();
});
