import { describe, it, expect, vi } from "vitest";
import { registerReadTools } from "../src/tools/read.js";

const account = { name: "main", companyId: 123, apiKey: "key-main" };

// Minimal fake McpServer capturing registrations.
function fakeServer() {
  const tools = new Map<string, { schema: any; handler: Function }>();
  return {
    tools,
    registerTool(name: string, def: any, handler: Function) {
      tools.set(name, { schema: def.inputSchema, handler });
    },
  };
}

describe("read tools", () => {
  it("registers all 7 read tools", () => {
    const srv = fakeServer();
    registerReadTools(srv as any, { accounts: new Map([["main", account]]), env: { SUMIT_DEFAULT_ACCOUNT: "main" } });
    expect([...srv.tools.keys()].sort()).toEqual(
      [
        "sumit_get_customer_debt",
        "sumit_get_customer_url",
        "sumit_get_debt_report",
        "sumit_get_document",
        "sumit_get_document_pdf",
        "sumit_list_documents",
        "sumit_list_income_items",
      ].sort(),
    );
  });

  it("sumit_list_documents posts to the list endpoint and returns Data as text", async () => {
    const srv = fakeServer();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ Status: "Success", Data: { Documents: [{ ID: 7 }] } }),
      text: async () => "",
    })) as any;
    registerReadTools(srv as any, {
      accounts: new Map([["main", account]]),
      env: { SUMIT_DEFAULT_ACCOUNT: "main" },
      fetchImpl,
    });
    const { handler } = srv.tools.get("sumit_list_documents")!;
    const res = await handler({});
    expect(fetchImpl.mock.calls[0][0]).toContain("/accounting/documents/list/");
    expect(res.content[0].text).toContain("\"ID\": 7");
  });
});
