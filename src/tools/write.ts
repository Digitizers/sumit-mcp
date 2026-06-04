import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildCreateDocumentPayload, normalizeCreateDocumentResponse } from "sumit-api";
import { sumitPost, sumitPostRaw, SUMIT_BASE_URL } from "../client.js";
import { resolveAccount } from "../accounts.js";
import type { ToolDeps } from "./read.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
const accountField = { account: z.string().optional().describe("Named SUMIT account; defaults to SUMIT_DEFAULT_ACCOUNT.") };

export function registerWriteTools(server: McpServer, deps: ToolDeps): void {
  const acct = (name?: string) => resolveAccount(deps.accounts, deps.env, name);
  const call = (path: string, params: Record<string, unknown>, name?: string) =>
    sumitPost(acct(name), path, params, { fetchImpl: deps.fetchImpl });

  server.registerTool(
    "sumit_create_document",
    {
      title: "Create document",
      description: "Issue a SUMIT accounting document (0=Invoice, 1=Invoice+Receipt, 2=Receipt, 3=Proforma/חשבון עסקה, 12=Quote) for a customer. Does NOT charge a card.",
      inputSchema: {
        ...accountField,
        documentType: z.number().describe("SUMIT document type code."),
        customerName: z.string(),
        customerEmail: z.string().optional(),
        customerExternalId: z.string().optional(),
        customerTaxId: z.string().optional().describe("Israeli ת.ז./ח.פ."),
        items: z.array(z.object({
          name: z.string(),
          description: z.string().optional(),
          unitPrice: z.number(),
          quantity: z.number().optional(),
        })).min(1),
        currency: z.enum(["ILS", "USD", "EUR"]).optional(),
        vatIncluded: z.boolean().optional(),
        language: z.string().optional(),
        sendByEmail: z.string().optional().describe("Recipient email to deliver the document to on creation."),
      },
    },
    async (a) => {
      const account = acct(a.account);
      const payload = buildCreateDocumentPayload({
        companyId: account.companyId,
        apiKey: account.apiKey,
        documentType: a.documentType,
        customer: { name: a.customerName, emailAddress: a.customerEmail, externalIdentifier: a.customerExternalId, taxId: a.customerTaxId, searchMode: a.customerExternalId ? 2 : 0 },
        items: a.items,
        currency: a.currency,
        vatIncluded: a.vatIncluded,
        language: a.language,
        sendByEmail: a.sendByEmail ? { emailAddress: a.sendByEmail } : undefined,
      });
      const data = await sumitPostRaw(`${SUMIT_BASE_URL}/accounting/documents/create/`, payload, { fetchImpl: deps.fetchImpl });
      return ok(normalizeCreateDocumentResponse({ Status: "Success", Data: data }));
    },
  );

  server.registerTool(
    "sumit_send_document",
    {
      title: "Send document by email",
      description: "Email an existing SUMIT document to a recipient.",
      inputSchema: { ...accountField, documentId: z.string(), emailAddress: z.string() },
    },
    async ({ account, documentId, emailAddress }) =>
      ok(await call("/accounting/documents/send/", { DocumentID: documentId, EmailAddress: emailAddress }, account)),
  );

  server.registerTool(
    "sumit_cancel_document",
    {
      title: "Cancel document",
      description: "Cancel (credit) an existing SUMIT document.",
      inputSchema: { ...accountField, documentId: z.string() },
    },
    async ({ account, documentId }) => ok(await call("/accounting/documents/cancel/", { DocumentID: documentId }, account)),
  );

  server.registerTool(
    "sumit_upsert_customer",
    {
      title: "Create or update customer",
      description: "Create a SUMIT customer, or update an existing one matched by ExternalIdentifier.",
      inputSchema: {
        ...accountField,
        name: z.string(),
        emailAddress: z.string().optional(),
        phone: z.string().optional(),
        externalIdentifier: z.string().optional(),
        taxId: z.string().optional(),
      },
    },
    async ({ account, name, emailAddress, phone, externalIdentifier, taxId }) => {
      const path = externalIdentifier ? "/accounting/customers/update/" : "/accounting/customers/create/";
      return ok(await call(path, {
        Customer: { Name: name, EmailAddress: emailAddress, Phone: phone, ExternalIdentifier: externalIdentifier, CompanyNumber: taxId, SearchMode: externalIdentifier ? 2 : 0 },
      }, account));
    },
  );

  server.registerTool(
    "sumit_create_income_item",
    {
      title: "Create income item",
      description: "Create a SUMIT catalog income item (product/service).",
      inputSchema: { ...accountField, name: z.string(), price: z.number().optional(), description: z.string().optional() },
    },
    async ({ account, name, price, description }) =>
      ok(await call("/accounting/incomeitems/create/", { Item: { Name: name, Price: price, Description: description } }, account)),
  );
}
