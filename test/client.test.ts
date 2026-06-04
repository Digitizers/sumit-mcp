import { describe, it, expect, vi } from "vitest";
import { sumitPost, SumitError } from "../src/client.js";

const account = { name: "main", companyId: 123, apiKey: "key-main" };

function mockFetch(body: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

describe("sumitPost", () => {
  it("injects Credentials and returns unwrapped Data on success", async () => {
    const fetchImpl = mockFetch({ Status: "Success", Data: { Documents: [{ ID: 1 }] } });
    const data = await sumitPost(account, "/accounting/documents/list/", { Page: 1 }, { fetchImpl });
    expect(data).toEqual({ Documents: [{ ID: 1 }] });
    const callArgs = (fetchImpl as any).mock.calls[0];
    expect(callArgs[0]).toBe("https://api.sumit.co.il/accounting/documents/list/");
    const sentBody = JSON.parse(callArgs[1].body);
    expect(sentBody.Credentials).toEqual({ CompanyID: 123, APIKey: "key-main" });
    expect(sentBody.Page).toBe(1);
  });

  it("throws SumitError with the redacted UserErrorMessage on a framework error", async () => {
    const fetchImpl = mockFetch({ Status: "Error", UserErrorMessage: "Invalid customer", Data: null });
    await expect(sumitPost(account, "/x/", {}, { fetchImpl })).rejects.toThrow(SumitError);
    await expect(sumitPost(account, "/x/", {}, { fetchImpl })).rejects.toThrow(/Invalid customer/);
  });

  it("never leaks the APIKey in a thrown error message", async () => {
    const fetchImpl = mockFetch({ Status: "Error", UserErrorMessage: "key-main was rejected", Data: null });
    try {
      await sumitPost(account, "/x/", {}, { fetchImpl });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toContain("key-main");
    }
  });

  it("throws on a non-2xx HTTP response", async () => {
    const fetchImpl = mockFetch({}, false);
    await expect(sumitPost(account, "/x/", {}, { fetchImpl })).rejects.toThrow(SumitError);
  });
});
