import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

describe("README", () => {
  it("advertised tool count matches registerTool calls in src/tools", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const claim = /\*\*(\d+) tools\*\*/.exec(readme);
    expect(claim, "README must advertise a tool count as `**N tools**`").not.toBeNull();

    const toolsDir = new URL("../src/tools/", import.meta.url);
    const actual = readdirSync(toolsDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(new URL(f, toolsDir), "utf8"))
      .reduce((n, src) => n + (src.match(/\.registerTool\(/g)?.length ?? 0), 0);

    expect(Number(claim![1])).toBe(actual);
  });
});
