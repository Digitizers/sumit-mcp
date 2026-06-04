#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadAccounts } from "./accounts.js";
import { registerReadTools, type ToolDeps } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";
import { registerChargeTools } from "./tools/charge.js";

async function main() {
  const env = process.env;
  const accounts = loadAccounts(env);
  const deps: ToolDeps = { accounts, env };

  const server = new McpServer({ name: "sumit-mcp", version: "1.0.0" });
  registerReadTools(server, deps);
  registerWriteTools(server, deps);
  registerChargeTools(server, deps);

  await server.connect(new StdioServerTransport());
  // stderr only — never write to stdout (reserved for the MCP protocol).
  console.error(`[sumit-mcp] ready — ${accounts.size} account(s), charge ${env.SUMIT_ALLOW_CHARGE === "1" ? "ENABLED" : "disabled"}.`);
}

main().catch((err) => {
  console.error(`[sumit-mcp] fatal: ${err?.message ?? err}`);
  process.exit(1);
});
