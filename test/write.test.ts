import { describe, it, expect, vi } from "vitest";
import { registerWriteTools } from "../src/tools/write.js";

const account = { name: "main", companyId: 123, apiKey: "key-main" };
function fakeServer() {
  const tools = new Map<string, { handler: Function }>();
  return { tools, registerTool(n: string, _d: any, h: Function) { tools.set(n, { handler: h }); } };
}
function okFetch(data: unknown) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ Status: "Success", Data: data }), text: async () => "" })) as any;
}

describe("write tools", () => {
  it("registers all 5 write tools", () => {
    const srv = fakeServer();
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {} });
    expect([...srv.tools.keys()].sort()).toEqual(
      ["sumit_cancel_document", "sumit_create_document", "sumit_create_income_item", "sumit_send_document", "sumit_upsert_customer"].sort(),
    );
  });

  it("create_document builds a payload carrying Credentials and posts it", async () => {
    const srv = fakeServer();
    const fetchImpl = okFetch({ DocumentID: 99 });
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {}, fetchImpl });
    const { handler } = srv.tools.get("sumit_create_document")!;
    const res = await handler({ documentType: 0, customerName: "Acme", items: [{ name: "Service", unitPrice: 100 }] });
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.Credentials).toEqual({ CompanyID: 123, APIKey: "key-main" });
    expect(sent.Details.Type).toBe(0);
    // NOTE: plan specified "invoice.created" but normalizeCreateDocumentResponse returns "document.created"
    // for all non-charge document creations. Adjusted to the library's actual output.
    expect(res.content[0].text).toContain("document.created");
  });

  it("does not leak the APIKey when the create endpoint returns an error", async () => {
    const srv = fakeServer();
    const errFetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ Status: "Error", UserErrorMessage: "auth failed for key-main", Data: null }),
      text: async () => "",
    })) as any;
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {}, fetchImpl: errFetch });
    const handler = srv.tools.get("sumit_create_document")!.handler;
    await expect(handler({ documentType: 0, customerName: "Acme", items: [{ name: "S", unitPrice: 100 }] })).rejects.toThrow();
    try {
      await handler({ documentType: 0, customerName: "Acme", items: [{ name: "S", unitPrice: 100 }] });
    } catch (e) {
      expect((e as Error).message).not.toContain("key-main");
    }
  });
});
