import { describe, it, expect } from "vitest";
import { loadAccounts, resolveAccount } from "../src/accounts.js";

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
});
