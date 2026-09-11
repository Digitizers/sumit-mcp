import { describe, it, expect, vi } from "vitest";
import { sumitPost, sumitPostRaw, SumitError } from "../src/client.js";

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
  // The string envelope is legacy/forward-compat only; the live API answers numerically (see below).
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

  it("returns Data when the live API reports numeric Status 0 (success)", async () => {
    const fetchImpl = mockFetch({
      Data: { Documents: [{ ID: 1 }] },
      Status: 0,
      UserErrorMessage: null,
      TechnicalErrorDetails: null,
    });
    const data = await sumitPost(account, "/accounting/documents/list/", {}, { fetchImpl });
    expect(data).toEqual({ Documents: [{ ID: 1 }] });
  });

  it("throws the UserErrorMessage on numeric Status 1 (user error)", async () => {
    const fetchImpl = mockFetch({
      Data: null,
      Status: 1,
      UserErrorMessage: "Invalid Credentials (CompanyID/APIKey are incorrect)",
      TechnicalErrorDetails: null,
    });
    await expect(sumitPost(account, "/x/", {}, { fetchImpl })).rejects.toThrow(/Invalid Credentials/);
  });

  // A numeric Status with no UserErrorMessage used to reach scrub() as a number and throw TypeError.
  it("stringifies a numeric Status when no UserErrorMessage is present", async () => {
    const fetchImpl = mockFetch({ Data: null, Status: 2, UserErrorMessage: null });
    await expect(sumitPost(account, "/x/", {}, { fetchImpl })).rejects.toThrow(SumitError);
    await expect(sumitPost(account, "/x/", {}, { fetchImpl })).rejects.toThrow(/2/);
  });

  it("throws on a non-2xx HTTP response", async () => {
    const fetchImpl = mockFetch({}, false);
    await expect(sumitPost(account, "/x/", {}, { fetchImpl })).rejects.toThrow(SumitError);
  });
});


describe("sumitPostRaw", () => {
  it("returns Data on numeric Status 0", async () => {
    const fetchImpl = mockFetch({ Data: { Payment: { ID: "p1" } }, Status: 0, UserErrorMessage: null });
    const data = await sumitPostRaw("https://api.sumit.co.il/billing/payments/charge/", {}, { fetchImpl });
    expect(data).toEqual({ Payment: { ID: "p1" } });
  });

  it("throws the UserErrorMessage on numeric Status 1", async () => {
    const fetchImpl = mockFetch({ Data: null, Status: 1, UserErrorMessage: "card declined" });
    await expect(
      sumitPostRaw("https://api.sumit.co.il/billing/payments/charge/", {}, { fetchImpl }),
    ).rejects.toThrow(/card declined/);
  });

  it("stringifies a numeric Status when no UserErrorMessage is present", async () => {
    const fetchImpl = mockFetch({ Data: null, Status: 2 });
    await expect(
      sumitPostRaw("https://api.sumit.co.il/x/", {}, { fetchImpl }),
    ).rejects.toThrow(/2/);
  });

  it("never leaks the APIKey in a thrown error message", async () => {
    const fetchImpl = mockFetch({ Data: null, Status: 1, UserErrorMessage: "key-raw was rejected" });
    await expect(
      sumitPostRaw("https://api.sumit.co.il/x/", {}, { fetchImpl, apiKey: "key-raw" }),
    ).rejects.toThrow(/\*\*\*/);
  });
});
