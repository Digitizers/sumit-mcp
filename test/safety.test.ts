import { describe, it, expect } from "vitest";
import {
  assertChargeEnabled,
  assertUnderCap,
  mintConfirmation,
  verifyConfirmation,
  type ChargeBinding,
} from "../src/safety.js";

const SECRET = "test-secret";
const binding: ChargeBinding = {
  account: "main",
  customer: "cust-1",
  amount: 1000,
  currency: "ILS",
  itemsHash: "abc",
};

describe("safety: capability flag", () => {
  it("refuses when SUMIT_ALLOW_CHARGE is not 1", () => {
    expect(() => assertChargeEnabled({ SUMIT_ALLOW_CHARGE: "0" })).toThrow(/SUMIT_ALLOW_CHARGE/);
    expect(() => assertChargeEnabled({})).toThrow(/SUMIT_ALLOW_CHARGE/);
  });
  it("allows when SUMIT_ALLOW_CHARGE is 1", () => {
    expect(() => assertChargeEnabled({ SUMIT_ALLOW_CHARGE: "1" })).not.toThrow();
  });
});

describe("safety: amount cap", () => {
  it("refuses above the per-account cap", () => {
    expect(() => assertUnderCap(6000, { SUMIT_MAX_CHARGE: "5000" })).toThrow(/cap/i);
  });
  it("allows at or below the cap", () => {
    expect(() => assertUnderCap(5000, { SUMIT_MAX_CHARGE: "5000" })).not.toThrow();
  });
  it("fails closed to the default cap when SUMIT_MAX_CHARGE is non-numeric", () => {
    expect(() => assertUnderCap(6000, { SUMIT_MAX_CHARGE: "unlimited" })).toThrow(/cap/i);
    expect(() => assertUnderCap(4000, { SUMIT_MAX_CHARGE: "unlimited" })).not.toThrow();
  });
  it("applies the default cap (5000) when SUMIT_MAX_CHARGE is unset", () => {
    expect(() => assertUnderCap(6000, {})).toThrow(/cap/i);
    expect(() => assertUnderCap(5000, {})).not.toThrow();
  });
});

describe("safety: confirmation token", () => {
  it("mints a token that verifies against the same binding", () => {
    const token = mintConfirmation(binding, SECRET, 60_000);
    expect(() => verifyConfirmation(token, binding, SECRET)).not.toThrow();
  });

  it("rejects a reused token (single-use)", () => {
    const token = mintConfirmation(binding, SECRET, 60_000);
    verifyConfirmation(token, binding, SECRET);
    expect(() => verifyConfirmation(token, binding, SECRET)).toThrow(/already used|unknown/i);
  });

  it("rejects an expired token", () => {
    const token = mintConfirmation(binding, SECRET, -1);
    expect(() => verifyConfirmation(token, binding, SECRET)).toThrow(/expired/i);
  });

  it("rejects a token signed with a different secret", () => {
    const token = mintConfirmation(binding, SECRET, 60_000);
    expect(() => verifyConfirmation(token, binding, "other-secret")).toThrow(/signature|invalid/i);
  });

  it.each([
    ["amount", { ...binding, amount: 2000 }],
    ["customer", { ...binding, customer: "cust-2" }],
    ["currency", { ...binding, currency: "USD" as const }],
    ["itemsHash", { ...binding, itemsHash: "different" }],
    ["account", { ...binding, account: "shop" }],
  ])("rejects drift in %s between prepare and execute", (_label, drifted) => {
    const token = mintConfirmation(binding, SECRET, 60_000);
    expect(() => verifyConfirmation(token, drifted, SECRET)).toThrow(/mismatch|drift/i);
  });
});
