import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sumitPost } from "../client.js";
import { resolveAccount, type SumitAccount } from "../accounts.js";

export interface ToolDeps {
  accounts: Map<string, SumitAccount>;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const accountField = { account: z.string().optional().describe("Named SUMIT account; defaults to SUMIT_DEFAULT_ACCOUNT.") };

export function registerReadTools(server: McpServer, deps: ToolDeps): void {
  const call = (path: string, params: Record<string, unknown>, account?: string) =>
    sumitPost(resolveAccount(deps.accounts, deps.env, account), path, params, { fetchImpl: deps.fetchImpl });

  server.registerTool(
    "sumit_list_documents",
    {
      title: "List documents",
      description: "List SUMIT accounting documents (invoices, receipts, quotes) filtered by date range, type, or customer.",
      inputSchema: {
        ...accountField,
        fromDate: z.string().optional().describe("ISO date lower bound."),
        toDate: z.string().optional().describe("ISO date upper bound."),
        documentType: z.number().optional().describe("SUMIT document type code (0=Invoice, 2=Receipt, 12=Quote)."),
        customerId: z.string().optional(),
        page: z.number().optional(),
      },
    },
    async ({ account, fromDate, toDate, documentType, customerId, page }) =>
      ok(await call("/accounting/documents/list/", {
        FromDate: fromDate, ToDate: toDate, Type: documentType, CustomerID: customerId, Page: page ?? 1,
      }, account)),
  );

  server.registerTool(
    "sumit_get_document",
    {
      title: "Get document",
      description: "Get full details of one SUMIT document by ID, or by document type + number.",
      inputSchema: { ...accountField, documentId: z.string().optional(), documentType: z.number().optional(), documentNumber: z.string().optional() },
    },
    async ({ account, documentId, documentType, documentNumber }) =>
      ok(await call("/accounting/documents/getdetails/", { DocumentID: documentId, Type: documentType, Number: documentNumber }, account)),
  );

  server.registerTool(
    "sumit_get_document_pdf",
    {
      title: "Get document PDF",
      description: "Get the PDF (URL or base64) for a SUMIT document.",
      inputSchema: { ...accountField, documentId: z.string().describe("SUMIT document ID.") },
    },
    async ({ account, documentId }) => ok(await call("/accounting/documents/getpdf/", { DocumentID: documentId }, account)),
  );

  server.registerTool(
    "sumit_get_customer_debt",
    {
      title: "Get customer debt",
      description: "Get the outstanding debt for one SUMIT customer.",
      inputSchema: { ...accountField, customerId: z.string().optional(), externalIdentifier: z.string().optional() },
    },
    async ({ account, customerId, externalIdentifier }) =>
      ok(await call("/accounting/documents/getdebt/", { CustomerID: customerId, ExternalIdentifier: externalIdentifier }, account)),
  );

  server.registerTool(
    "sumit_get_debt_report",
    {
      title: "Get debt report",
      description: "Get the debt report across all SUMIT customers.",
      inputSchema: { ...accountField },
    },
    async ({ account }) => ok(await call("/accounting/documents/getdebtreport/", {}, account)),
  );

  server.registerTool(
    "sumit_list_income_items",
    {
      title: "List income items",
      description: "List SUMIT catalog/income items (products and services).",
      inputSchema: { ...accountField },
    },
    async ({ account }) => ok(await call("/accounting/incomeitems/list/", {}, account)),
  );

  server.registerTool(
    "sumit_get_customer_url",
    {
      title: "Get customer page URL",
      description: "Get the SUMIT details-page URL for a customer (no raw data export endpoint exists).",
      inputSchema: { ...accountField, customerId: z.string().optional(), externalIdentifier: z.string().optional() },
    },
    async ({ account, customerId, externalIdentifier }) =>
      ok(await call("/accounting/customers/getdetailsurl/", { CustomerID: customerId, ExternalIdentifier: externalIdentifier }, account)),
  );
}
