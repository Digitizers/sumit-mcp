import { describe, it, expect, vi } from "vitest";
import { registerChargeTools } from "../src/tools/charge.js";

const account = { name: "main", companyId: 123, apiKey: "key-main" };
function fakeServer() {
  const tools = new Map<string, { handler: Function }>();
  return { tools, registerTool(n: string, _d: any, h: Function) { tools.set(n, { handler: h }); } };
}
function okFetch() {
  return vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ Status: "Success", Data: { Payment: { Status: "000", ValidPayment: true, ID: "p1" } } }),
    text: async () => "",
  })) as any;
}
const baseEnv = { SUMIT_DEFAULT_ACCOUNT: "main", SUMIT_ALLOW_CHARGE: "1", SUMIT_MAX_CHARGE: "5000", SUMIT_CONFIRM_SECRET: "s" };
const deps = (env: any, fetchImpl?: any) => ({ accounts: new Map([["main", account]]), env, fetchImpl });

const prepInput = {
  mode: "one_off" as const,
  customerExternalId: "cust-1",
  customerName: "Acme",
  customerEmail: "a@acme.test",
  item: { name: "Retainer", description: "June", unitPrice: 1000 },
  currency: "ILS" as const,
};

describe("charge tools", () => {
  it("registers prepare + execute", () => {
    const srv = fakeServer();
    registerChargeTools(srv as any, deps(baseEnv));
    expect([...srv.tools.keys()].sort()).toEqual(["sumit_execute_charge", "sumit_prepare_charge"]);
  });

  it("execute refuses when SUMIT_ALLOW_CHARGE != 1", async () => {
    const srv = fakeServer();
    registerChargeTools(srv as any, deps({ ...baseEnv, SUMIT_ALLOW_CHARGE: "0" }));
    const exec = srv.tools.get("sumit_execute_charge")!.handler;
    await expect(exec({ confirmationToken: "x", singleUseToken: "t" })).rejects.toThrow(/SUMIT_ALLOW_CHARGE/);
  });

  it("prepare returns a token; execute with it charges and returns a normalized event", async () => {
    const srv = fakeServer();
    const fetchImpl = okFetch();
    registerChargeTools(srv as any, deps(baseEnv, fetchImpl));
    const prep = await srv.tools.get("sumit_prepare_charge")!.handler(prepInput);
    const token = JSON.parse(prep.content[0].text).confirmationToken;
    expect(token).toBeTruthy();
    const res = await srv.tools.get("sumit_execute_charge")!.handler({ ...prepInput, confirmationToken: token, singleUseToken: "browser-tok" });
    expect(fetchImpl.mock.calls[0][0]).toContain("/billing/payments/charge/");
    expect(res.content[0].text).toContain("payment.succeeded");
  });

  it("execute rejects a tampered/incorrect token", async () => {
    const srv = fakeServer();
    registerChargeTools(srv as any, deps(baseEnv, okFetch()));
    const prep = await srv.tools.get("sumit_prepare_charge")!.handler(prepInput);
    const token = JSON.parse(prep.content[0].text).confirmationToken;
    await expect(
      srv.tools.get("sumit_execute_charge")!.handler({ ...prepInput, confirmationToken: token + "x", singleUseToken: "t" }),
    ).rejects.toThrow();
  });

  it("prepare refuses an over-cap amount", async () => {
    const srv = fakeServer();
    registerChargeTools(srv as any, deps(baseEnv, okFetch()));
    await expect(
      srv.tools.get("sumit_prepare_charge")!.handler({ ...prepInput, item: { ...prepInput.item, unitPrice: 99999 } }),
    ).rejects.toThrow(/cap/i);
  });

  it("execute refuses when SUMIT_CONFIRM_SECRET is unset (charging enabled)", async () => {
    const srv = fakeServer();
    const env = { SUMIT_DEFAULT_ACCOUNT: "main", SUMIT_ALLOW_CHARGE: "1", SUMIT_MAX_CHARGE: "5000" }; // no SUMIT_CONFIRM_SECRET
    registerChargeTools(srv as any, deps(env, okFetch()));
    await expect(
      srv.tools.get("sumit_execute_charge")!.handler({ ...prepInput, confirmationToken: "x", singleUseToken: "t" }),
    ).rejects.toThrow(/SUMIT_CONFIRM_SECRET/);
  });
});
