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
      json: async () => ({ Data: { Documents: [{ ID: 7 }] }, Status: 0, UserErrorMessage: null }),
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
  it("sumit_list_documents sends the filter names SUMIT actually reads", async () => {
    const srv = fakeServer();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ Data: { Documents: [], HasNextPage: false }, Status: 0, UserErrorMessage: null }),
      text: async () => "",
    })) as any;
    registerReadTools(srv as any, {
      accounts: new Map([["main", account]]),
      env: { SUMIT_DEFAULT_ACCOUNT: "main" },
      fetchImpl,
    });
    const { handler, schema } = srv.tools.get("sumit_list_documents")!;

    await handler({ fromDate: "2026-01-01", toDate: "2026-01-31", documentType: 12, startIndex: 10, pageSize: 50 });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.DateFrom).toBe("2026-01-01");
    expect(body.DateTo).toBe("2026-01-31");
    expect(body.DocumentTypes).toEqual([12]);
    expect(body.Paging).toEqual({ StartIndex: 10, PageSize: 50 });
    // Names SUMIT silently ignores — sending them returned the same unfiltered first page forever.
    for (const ignored of ["FromDate", "ToDate", "Type", "CustomerID", "Page"]) {
      expect(body).not.toHaveProperty(ignored);
    }

    await handler({});
    const bare = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(Object.keys(bare)).toEqual(["Credentials"]);

    // The list endpoint has no customer filter, so the tool must not advertise one.
    expect(Object.keys(schema)).not.toContain("customerId");
    expect(Object.keys(schema)).not.toContain("page");
  });

  it("sumit_get_document locates by DocumentType + DocumentNumber", async () => {
    const srv = fakeServer();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ Data: { Document: { ID: 7 } }, Status: 0, UserErrorMessage: null }),
      text: async () => "",
    })) as any;
    registerReadTools(srv as any, {
      accounts: new Map([["main", account]]),
      env: { SUMIT_DEFAULT_ACCOUNT: "main" },
      fetchImpl,
    });
    const { handler } = srv.tools.get("sumit_get_document")!;
    await handler({ documentType: 0, documentNumber: "1042" });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.DocumentType).toBe(0);
    expect(body.DocumentNumber).toBe("1042");
    expect(body).not.toHaveProperty("Type");
    expect(body).not.toHaveProperty("Number");
  });

  it("sumit_get_debt_report sends the required DebitSource/CreditSource enums", async () => {
    const srv = fakeServer();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ Data: { Debts: [] }, Status: 0, UserErrorMessage: null }),
      text: async () => "",
    })) as any;
    registerReadTools(srv as any, {
      accounts: new Map([["main", account]]),
      env: { SUMIT_DEFAULT_ACCOUNT: "main" },
      fetchImpl,
    });
    const { handler } = srv.tools.get("sumit_get_debt_report")!;
    await handler({});
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.DebitSource).toBe(1);
    expect(body.CreditSource).toBe(2);

    await handler({ debitSource: 3, creditSource: 4 });
    const override = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(override.DebitSource).toBe(3);
    expect(override.CreditSource).toBe(4);
  });
});
