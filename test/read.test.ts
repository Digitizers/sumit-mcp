import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
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

  it("sumit_get_debt_report sends the DebitSource/CreditSource pair the caller chose, and has no default", async () => {
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
    const { schema, handler } = srv.tools.get("sumit_get_debt_report")!;
    await handler({ debitSource: 1, creditSource: 4 });
    const { Credentials: _c, ...body } = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({ DebitSource: 1, CreditSource: 4 });

    // The old default was 1 and 2: tax invoices minus proformas, which reports paid invoices as owed.
    await expect(handler({})).rejects.toThrow(/sumit_get_debt_report: debitSource is required/);
    await expect(handler({ debitSource: 1 })).rejects.toThrow(/creditSource is required/);
    await expect(handler({ debitSource: 7, creditSource: 4 })).rejects.toThrow(/debitSource is required and must be one of/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const parse = (input: unknown) => z.object(schema).safeParse(input).success;
    expect(parse({})).toBe(false);
    expect(parse({ debitSource: 1 })).toBe(false);
    expect(parse({ debitSource: 1, creditSource: 4 })).toBe(true);
    expect(parse({ debitSource: 0, creditSource: 4 })).toBe(false);
    expect(parse({ debitSource: 1, creditSource: 7 })).toBe(false);
  });

  it("sumit_get_customer_debt sends the fields SUMIT's request schema has", async () => {
    const srv = fakeServer();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ Data: { Debt: 6431 }, Status: 0, UserErrorMessage: null }),
      text: async () => "",
    })) as any;
    registerReadTools(srv as any, {
      accounts: new Map([["main", account]]),
      env: { SUMIT_DEFAULT_ACCOUNT: "main" },
      fetchImpl,
    });
    const { handler } = srv.tools.get("sumit_get_customer_debt")!;
    const res = await handler({ customerId: "4711", debitSource: 1, creditSource: 4 });
    expect(fetchImpl.mock.calls[0][0]).toContain("/accounting/documents/getdebt/");
    const { Credentials, ...body } = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(Credentials).toEqual({ CompanyID: 123, APIKey: "key-main" });
    expect(body).toEqual({ CustomerID: 4711, DebitSource: 1, CreditSource: 4 });
    expect(res.content[0].text).toContain("6431");

    await handler({ customerId: "4711", debitSource: 2, creditSource: 4, includeDraftDocuments: true });
    const { Credentials: _c, ...override } = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(override).toEqual({ CustomerID: 4711, DebitSource: 2, CreditSource: 4, IncludeDraftDocuments: true });
  });

  it.each(["12a", "-5", "1.5", " ", "99999999999999999999", undefined])(
    "sumit_get_customer_debt rejects the customerId %j before calling SUMIT",
    async (customerId) => {
      const srv = fakeServer();
      const fetchImpl = vi.fn() as any;
      registerReadTools(srv as any, {
        accounts: new Map([["main", account]]),
        env: { SUMIT_DEFAULT_ACCOUNT: "main" },
        fetchImpl,
      });
      const { handler } = srv.tools.get("sumit_get_customer_debt")!;
      await expect(handler({ customerId, debitSource: 1, creditSource: 4 })).rejects.toThrow(/customerId/);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("sumit_get_customer_debt requires customerId and both sources, and has no lookup by external identifier", async () => {
    const srv = fakeServer();
    const fetchImpl = vi.fn() as any;
    registerReadTools(srv as any, { accounts: new Map([["main", account]]), env: { SUMIT_DEFAULT_ACCOUNT: "main" }, fetchImpl });
    const { schema, handler } = srv.tools.get("sumit_get_customer_debt")!;
    const parse = (input: unknown) => z.object(schema).safeParse(input).success;
    expect(parse({})).toBe(false);
    expect(parse({ customerId: "4711" })).toBe(false);
    expect(parse({ customerId: "4711", debitSource: 1 })).toBe(false);
    expect(parse({ customerId: "4711", creditSource: 4 })).toBe(false);
    expect(parse({ customerId: "4711", debitSource: 1, creditSource: 4 })).toBe(true);
    expect(parse({ customerId: "4711", debitSource: 6, creditSource: 6 })).toBe(true);
    expect(parse({ customerId: "4711", debitSource: 7, creditSource: 4 })).toBe(false);
    expect(parse({ customerId: "4711", debitSource: 1, creditSource: 0 })).toBe(false);
    expect(parse({ customerId: "4711", debitSource: 1.5, creditSource: 4 })).toBe(false);
    expect(schema).not.toHaveProperty("externalIdentifier");

    // No default pair: a wrong one returns a plausible but wrong balance.
    await expect(handler({ customerId: "4711" })).rejects.toThrow(/debitSource is required/);
    await expect(handler({ customerId: "4711", debitSource: 1 })).rejects.toThrow(/creditSource is required/);
    await expect(handler({ customerId: "4711", debitSource: 0, creditSource: 4 })).rejects.toThrow(/debitSource is required/);
    // SUMIT's enum is closed at six values; anything else would be sent as an invalid source.
    await expect(handler({ customerId: "4711", debitSource: 7, creditSource: 4 })).rejects.toThrow(/debitSource is required and must be one of/);
    await expect(handler({ customerId: "4711", debitSource: 1, creditSource: 7 })).rejects.toThrow(/creditSource is required and must be one of/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
