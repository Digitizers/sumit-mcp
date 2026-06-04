import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildOneOffChargePayload, buildRecurringChargePayload, normalizeChargeResponse } from "sumit-api";
import { sumitPostRaw, SUMIT_BASE_URL } from "../client.js";
import { resolveAccount } from "../accounts.js";
import { assertChargeEnabled, assertUnderCap, mintConfirmation, verifyConfirmation, auditCharge, type ChargeBinding } from "../safety.js";
import type { ToolDeps } from "./read.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const itemShape = z.object({
  name: z.string(),
  description: z.string(),
  unitPrice: z.number(),
  quantity: z.number().optional(),
  durationMonths: z.number().optional().describe("Recurring only: charge period in months."),
  recurrence: z.number().optional(),
});

function amountOf(item: { unitPrice: number; quantity?: number }): number {
  return item.unitPrice * (item.quantity ?? 1);
}
function itemsHash(item: unknown): string {
  return createHash("sha256").update(JSON.stringify(item)).digest("hex").slice(0, 16);
}

export function registerChargeTools(server: McpServer, deps: ToolDeps): void {
  const secret = deps.env.SUMIT_CONFIRM_SECRET || "insecure-default-set-SUMIT_CONFIRM_SECRET";

  server.registerTool(
    "sumit_prepare_charge",
    {
      title: "Prepare a charge (no money moves yet)",
      description: "Validate and preview a one-off or recurring charge. Returns a human-readable summary and a confirmation_token. SHOW the summary to the user and get explicit approval, then call sumit_execute_charge with the token. This does NOT charge anything.",
      inputSchema: {
        account: z.string().optional(),
        mode: z.enum(["one_off", "recurring"]),
        customerExternalId: z.string(),
        customerName: z.string(),
        customerEmail: z.string(),
        item: itemShape,
        currency: z.enum(["ILS", "USD", "EUR"]),
      },
    },
    async (a) => {
      const account = resolveAccount(deps.accounts, deps.env, a.account);
      const amount = amountOf(a.item);
      assertUnderCap(amount, deps.env);
      const binding: ChargeBinding = { account: account.name, customer: a.customerExternalId, amount, currency: a.currency, itemsHash: itemsHash(a.item) };
      const token = mintConfirmation(binding, secret, 5 * 60_000);
      auditCharge("prepare", `account=${account.name} customer=${a.customerExternalId} amount=${amount} ${a.currency} mode=${a.mode}`);
      return ok({
        summary: `${a.mode === "recurring" ? "RECURRING" : "ONE-OFF"} charge of ${amount} ${a.currency} to ${a.customerName} (${a.customerExternalId}) for "${a.item.name}".`,
        amount, currency: a.currency, mode: a.mode, confirmationToken: token,
        next: "Show this summary to the user. On approval, call sumit_execute_charge with this confirmationToken and a single_use_token from a real checkout.",
      });
    },
  );

  server.registerTool(
    "sumit_execute_charge",
    {
      title: "Execute a prepared charge (moves money)",
      description: "Perform the charge prepared by sumit_prepare_charge. Requires the confirmation_token AND a single_use_token produced by a SUMIT browser checkout (an agent cannot mint card tokens). Refuses unless SUMIT_ALLOW_CHARGE=1.",
      inputSchema: {
        account: z.string().optional(),
        confirmationToken: z.string(),
        singleUseToken: z.string().describe("One-time card token from a SUMIT browser checkout."),
        mode: z.enum(["one_off", "recurring"]),
        customerExternalId: z.string(),
        customerName: z.string(),
        customerEmail: z.string(),
        item: itemShape,
        currency: z.enum(["ILS", "USD", "EUR"]),
      },
    },
    async (a) => {
      assertChargeEnabled(deps.env);
      const account = resolveAccount(deps.accounts, deps.env, a.account);
      const amount = amountOf(a.item);
      const binding: ChargeBinding = { account: account.name, customer: a.customerExternalId, amount, currency: a.currency, itemsHash: itemsHash(a.item) };
      verifyConfirmation(a.confirmationToken, binding, secret); // throws on drift/expiry/reuse
      assertUnderCap(amount, deps.env);

      const common = {
        companyId: account.companyId, apiKey: account.apiKey, singleUseToken: a.singleUseToken,
        customer: { externalIdentifier: a.customerExternalId, name: a.customerName, emailAddress: a.customerEmail },
      };
      const path = a.mode === "recurring" ? "/billing/recurring/charge/" : "/billing/payments/charge/";
      const payload = a.mode === "recurring"
        ? buildRecurringChargePayload({ ...common, item: { name: a.item.name, description: a.item.description, unitPrice: a.item.unitPrice, quantity: a.item.quantity, currency: a.currency, durationMonths: a.item.durationMonths ?? 1, recurrence: a.item.recurrence } })
        : buildOneOffChargePayload({ ...common, item: { name: a.item.name, description: a.item.description, unitPrice: a.item.unitPrice, quantity: a.item.quantity, currency: a.currency } });

      try {
        const data = await sumitPostRaw(`${SUMIT_BASE_URL}${path}`, payload, { fetchImpl: deps.fetchImpl });
        auditCharge("execute", `account=${account.name} customer=${a.customerExternalId} amount=${amount} ${a.currency}`);
        return ok(normalizeChargeResponse({ Status: "Success", Data: data }));
      } catch (err) {
        auditCharge("execute-failed", `account=${account.name} customer=${a.customerExternalId} amount=${amount}: ${String((err as Error).message)}`);
        throw err;
      }
    },
  );
}
