import { describe, it, expect } from "vitest";
import { redactText, redactObject } from "../src/redact.js";

describe("redact", () => {
  it("scrubs an api key value from free text", () => {
    const out = redactText("call failed apikey=sk_live_abc123 for company");
    expect(out).not.toContain("sk_live_abc123");
  });

  it("scrubs a card-like number and Upay code from text", () => {
    const out = redactText("Upay_30001419 on card 4580123412341234");
    expect(out).not.toContain("4580123412341234");
    expect(out).not.toContain("Upay_30001419");
  });

  it("redacts APIKey inside a nested payload object", () => {
    const out = redactObject({ Credentials: { CompanyID: 1, APIKey: "secret-key" } });
    expect(JSON.stringify(out)).not.toContain("secret-key");
  });
});
