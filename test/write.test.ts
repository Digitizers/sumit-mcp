import { describe, it, expect, vi } from "vitest";
import { registerWriteTools } from "../src/tools/write.js";

const account = { name: "main", companyId: 123, apiKey: "key-main" };
function fakeServer() {
  const tools = new Map<string, { handler: Function }>();
  return { tools, registerTool(n: string, _d: any, h: Function) { tools.set(n, { handler: h }); } };
}
function okFetch(data: unknown) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ Data: data, Status: 0, UserErrorMessage: null }), text: async () => "" })) as any;
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

  it("create_document saves a draft when isDraft is set, and omits the flag otherwise", async () => {
    const srv = fakeServer();
    const fetchImpl = okFetch({ DocumentID: 99 });
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {}, fetchImpl });
    const { handler } = srv.tools.get("sumit_create_document")!;
    await handler({ documentType: 3, customerName: "Acme", isDraft: true, items: [{ name: "Service", unitPrice: 100 }] });
    await handler({ documentType: 3, customerName: "Acme", items: [{ name: "Service", unitPrice: 100 }] });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).Details.IsDraft).toBe(true);
    expect("IsDraft" in JSON.parse(fetchImpl.mock.calls[1][1].body).Details).toBe(false);
  });

  it("create_document addresses an existing customer by its numeric SUMIT ID, without a search", async () => {
    const srv = fakeServer();
    const fetchImpl = okFetch({ DocumentID: 99 });
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {}, fetchImpl });
    const { handler } = srv.tools.get("sumit_create_document")!;
    await handler({ documentType: 3, customerName: "Acme", customerId: "4711", items: [{ name: "Service", unitPrice: 100 }] });
    const customer = JSON.parse(fetchImpl.mock.calls[0][1].body).Details.Customer;
    expect(customer.ID).toBe(4711);
    expect(customer.SearchMode).toBe(1);
  });

  it("create_document keeps the existing search modes when no customerId is given", async () => {
    const srv = fakeServer();
    const fetchImpl = okFetch({ DocumentID: 99 });
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {}, fetchImpl });
    const { handler } = srv.tools.get("sumit_create_document")!;
    await handler({ documentType: 0, customerName: "Acme", items: [{ name: "Service", unitPrice: 100 }] });
    await handler({ documentType: 0, customerName: "Acme", customerExternalId: "crm-7", items: [{ name: "Service", unitPrice: 100 }] });
    const first = JSON.parse(fetchImpl.mock.calls[0][1].body).Details.Customer;
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body).Details.Customer;
    expect(first.SearchMode).toBe(0);
    expect("ID" in first).toBe(false);
    expect(second.SearchMode).toBe(2);
  });

  it.each(["12a", "-5", "1.5", " ", "99999999999999999999"])("create_document rejects the malformed customerId %j before calling SUMIT", async (customerId) => {
    const srv = fakeServer();
    const fetchImpl = okFetch({ DocumentID: 99 });
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {}, fetchImpl });
    const { handler } = srv.tools.get("sumit_create_document")!;
    await expect(handler({ documentType: 3, customerName: "Acme", customerId, items: [{ name: "Service", unitPrice: 100 }] })).rejects.toThrow(/customerId/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("create_document refuses to email a draft", async () => {
    const srv = fakeServer();
    const fetchImpl = okFetch({ DocumentID: 99 });
    registerWriteTools(srv as any, { accounts: new Map([["main", account]]), env: {}, fetchImpl });
    const { handler } = srv.tools.get("sumit_create_document")!;
    await expect(handler({ documentType: 3, customerName: "Acme", isDraft: true, sendByEmail: "a@example.com", items: [{ name: "Service", unitPrice: 100 }] })).rejects.toThrow(/draft/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not leak the APIKey when the create endpoint returns an error", async () => {
    const srv = fakeServer();
    const errFetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ Data: null, Status: 1, UserErrorMessage: "auth failed for key-main" }),
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
