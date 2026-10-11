import { describe, it, expect } from "vitest";
import { loadAccounts, requireAccounts, resolveAccount } from "../src/accounts.js";

const ENV = {
  SUMIT_DEFAULT_ACCOUNT: "main",
  SUMIT_MAIN_COMPANY_ID: "123",
  SUMIT_MAIN_API_KEY: "key-main",
  SUMIT_SHOP_COMPANY_ID: "456",
  SUMIT_SHOP_API_KEY: "key-shop",
};

describe("accounts", () => {
  it("loads all accounts from env", () => {
    const accts = loadAccounts(ENV);
    expect(accts.get("main")).toEqual({ name: "main", companyId: 123, apiKey: "key-main" });
    expect(accts.get("shop")).toEqual({ name: "shop", companyId: 456, apiKey: "key-shop" });
  });

  it("resolves the default account when none requested", () => {
    expect(resolveAccount(loadAccounts(ENV), ENV).name).toBe("main");
  });

  it("resolves a named account", () => {
    expect(resolveAccount(loadAccounts(ENV), ENV, "shop").apiKey).toBe("key-shop");
  });

  it("throws a clear error for an unknown account", () => {
    expect(() => resolveAccount(loadAccounts(ENV), ENV, "ghost")).toThrow(/unknown account "ghost"/i);
  });

  it("throws when no accounts are configured", () => {
    expect(() => resolveAccount(loadAccounts({}), {})).toThrow(/no SUMIT accounts/i);
  });

  // Claude Code passes an unset `${VAR}` through as literal text instead of refusing to
  // launch, so the placeholder itself must never be accepted as a credential.
  it("ignores an account whose API key is an unexpanded placeholder", () => {
    const accts = loadAccounts({ SUMIT_MAIN_COMPANY_ID: "123", SUMIT_MAIN_API_KEY: "${SUMIT_MAIN_API_KEY}" });
    expect(accts.size).toBe(0);
  });

  it("ignores an account whose company ID is an unexpanded placeholder", () => {
    const accts = loadAccounts({ SUMIT_MAIN_COMPANY_ID: "${SUMIT_MAIN_COMPANY_ID}", SUMIT_MAIN_API_KEY: "key-main" });
    expect(accts.size).toBe(0);
  });

  it("keeps a real account when another one is left as a placeholder", () => {
    const accts = loadAccounts({ ...ENV, SUMIT_SHOP_API_KEY: "${SUMIT_SHOP_API_KEY}" });
    expect([...accts.keys()]).toEqual(["main"]);
  });

  it("requireAccounts refuses to start with no usable account", () => {
    expect(() => requireAccounts(loadAccounts({}))).toThrow(/no SUMIT accounts/i);
    expect(() => requireAccounts(loadAccounts(ENV))).not.toThrow();
  });
});
