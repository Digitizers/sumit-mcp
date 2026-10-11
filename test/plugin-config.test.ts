import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

interface ServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

function readJson(path: string): { mcpServers?: Record<string, ServerConfig> } {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

describe("plugin MCP config", () => {
  const plugin = readJson("../.claude-plugin/plugin.json").mcpServers?.sumit;
  const clone = readJson("../.mcp.json").mcpServers?.sumit;

  // Claude Code resolves `${CLAUDE_PLUGIN_ROOT:-.}` to `.` for an installed plugin, so the
  // server was launched from the session's working directory and never connected.
  it("launches the bundle from the plugin root with no fallback", () => {
    expect(plugin?.args).toEqual(["${CLAUDE_PLUGIN_ROOT}/dist/bundle.mjs"]);
  });

  it("keeps the clone config runnable from the repo root", () => {
    expect(clone?.args).toEqual(["${CLAUDE_PLUGIN_ROOT:-.}/dist/bundle.mjs"]);
  });

  it("matches the clone config in everything but the bundle path", () => {
    expect(plugin?.command).toBe(clone?.command);
    expect(plugin?.env).toEqual(clone?.env);
  });

  it("keeps the credentials as bare placeholders so an unset value fails closed", () => {
    expect(plugin?.env.SUMIT_MAIN_COMPANY_ID).toBe("${SUMIT_MAIN_COMPANY_ID}");
    expect(plugin?.env.SUMIT_MAIN_API_KEY).toBe("${SUMIT_MAIN_API_KEY}");
  });
});
