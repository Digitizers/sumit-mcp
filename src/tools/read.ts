import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sumitPost } from "../client.js";
import { resolveAccount, type SumitAccount } from "../accounts.js";
import { parseCustomerId } from "./customer-id.js";

export interface ToolDeps {
  accounts: Map<string, SumitAccount>;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const accountField = { account: z.string().optional().describe("Named SUMIT account; defaults to SUMIT_DEFAULT_ACCOUNT.") };

// SUMIT's DebtSettlementSource enum, from its published schema: six values, 1 to 6.
const DEBT_SOURCE_MAX = 6;
const DEBT_SOURCE_VALUES =
  "1=TaxInvoice, 2=ProformaInvoice, 3=PaymentRequest, 4=Receipt, 5=ProformaInvoice+PaymentRequest, 6=ProformaInvoice+PaymentRequest+TaxInvoice.";

// SUMIT's RecurringCustomerItemStatus enum, from its published schema.
const RECURRING_STATUS_VALUES =
  "0=Active, 1=Cancelled, 3=Disabled after a failed payment, 9=Finished or expired, 11=Grace period, " +
  "12=Pending first payment, 13=Cancelled by the customer, 14=Pending retry.";

// The schemas already require both sources. This covers a caller that reaches a handler
// without validation: a missing or out-of-range source must not turn into a request.
function requireDebtSources(tool: string, debitSource: unknown, creditSource: unknown): void {
  for (const [name, value] of [["debitSource", debitSource], ["creditSource", creditSource]] as const) {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > DEBT_SOURCE_MAX) {
      throw new Error(`${tool}: ${name} is required and must be one of: ${DEBT_SOURCE_VALUES}`);
    }
  }
}

export function registerReadTools(server: McpServer, deps: ToolDeps): void {
  const call = (path: string, params: Record<string, unknown>, account?: string) =>
    sumitPost(resolveAccount(deps.accounts, deps.env, account), path, params, { fetchImpl: deps.fetchImpl });

  server.registerTool(
    "sumit_list_documents",
    {
      title: "List documents",
      description:
        "List SUMIT accounting documents (invoices, receipts, quotes) filtered by date range or type. " +
        "SUMIT has no customer filter on this endpoint: narrow by date and read the customer off each document. " +
        "Returns one page per call; HasNextPage in the response says whether more exist.",
      inputSchema: {
        ...accountField,
        fromDate: z.string().optional().describe("ISO date lower bound."),
        toDate: z.string().optional().describe("ISO date upper bound."),
        documentType: z.number().optional().describe("SUMIT document type code (0=Invoice, 2=Receipt, 12=Quote)."),
        startIndex: z.number().int().nonnegative().optional().describe("SUMIT Paging.StartIndex. Omit for the first page."),
        pageSize: z
          .number()
          .int()
          .min(10)
          .max(1000)
          .optional()
          .describe("Documents per page. SUMIT defaults to 10 and accepts 10 to 1000."),
      },
    },
    // SUMIT ignores field names it does not know instead of rejecting them, so a wrong name
    // returns the unfiltered first page with HasNextPage true — an endless loop for any pager.
    async ({ account, fromDate, toDate, documentType, startIndex, pageSize }) =>
      ok(await call("/accounting/documents/list/", {
        DateFrom: fromDate,
        DateTo: toDate,
        DocumentTypes: documentType === undefined ? undefined : [documentType],
        Paging: startIndex === undefined && pageSize === undefined ? undefined : { StartIndex: startIndex, PageSize: pageSize },
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
      ok(await call("/accounting/documents/getdetails/", { DocumentID: documentId, DocumentType: documentType, DocumentNumber: documentNumber }, account)),
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
      description:
        "Get the outstanding debt for one SUMIT customer, by its numeric SUMIT customer ID. " +
        "The ID is on every row of sumit_list_documents. The endpoint has no lookup by external identifier. " +
        "debitSource and creditSource are required and decide the result: the debt is the documents of the debit kind " +
        "minus the documents of the credit kind. Pick the pair that matches how this business bills and records payment.",
      inputSchema: {
        ...accountField,
        customerId: z.string().describe("Numeric SUMIT customer ID."),
        debitSource: z.number().int().min(1).max(DEBT_SOURCE_MAX).describe(`Required. Which documents count as debt. ${DEBT_SOURCE_VALUES}`),
        creditSource: z.number().int().min(1).max(DEBT_SOURCE_MAX).describe(`Required. Which documents settle the debt. ${DEBT_SOURCE_VALUES}`),
        includeDraftDocuments: z.boolean().optional().describe("Count draft documents too. SUMIT leaves them out by default."),
      },
    },
    // Without DebitSource the endpoint fails with "שדה חסר: DebitSource". The pair has no
    // default here: a wrong one returns a plausible number (a paid invoice still shown as
    // owed, or a negative balance), so the caller has to choose it. SUMIT ignores unknown
    // fields, so anything outside its request schema (an external identifier, for one)
    // would be dropped without an error.
    async ({ account, customerId, debitSource, creditSource, includeDraftDocuments }) => {
      const id = parseCustomerId("sumit_get_customer_debt", customerId);
      if (id === undefined) {
        throw new Error("sumit_get_customer_debt: customerId is required.");
      }
      requireDebtSources("sumit_get_customer_debt", debitSource, creditSource);
      return ok(
        await call(
          "/accounting/documents/getdebt/",
          {
            CustomerID: id,
            DebitSource: debitSource,
            CreditSource: creditSource,
            IncludeDraftDocuments: includeDraftDocuments,
          },
          account,
        ),
      );
    },
  );

  server.registerTool(
    "sumit_get_debt_report",
    {
      title: "Get debt report",
      description:
        "Get the debt report across all SUMIT customers: one balance per customer ID, without names. " +
        "debitSource and creditSource are required and decide every number: each balance is the documents of the debit kind " +
        "minus the documents of the credit kind. Pick the pair that matches how this business bills and records payment. " +
        "Many negative balances, or paid invoices shown as owed, mean the pair does not fit the bookkeeping.",
      inputSchema: {
        ...accountField,
        debitSource: z.number().int().min(1).max(DEBT_SOURCE_MAX).describe(`Required. Which documents count as debt. ${DEBT_SOURCE_VALUES}`),
        creditSource: z.number().int().min(1).max(DEBT_SOURCE_MAX).describe(`Required. Which documents settle the debt. ${DEBT_SOURCE_VALUES}`),
      },
    },
    // The endpoint requires both enums: an empty body always fails with "שדה חסר: DebitSource".
    // They had defaults of 1 and 2 here, which is tax invoices minus proformas, not minus
    // receipts, so the report showed paid invoices as owed. No pair fits every account.
    async ({ account, debitSource, creditSource }) => {
      requireDebtSources("sumit_get_debt_report", debitSource, creditSource);
      return ok(
        await call("/accounting/documents/getdebtreport/", { DebitSource: debitSource, CreditSource: creditSource }, account),
      );
    },
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
    "sumit_list_customer_recurring",
    {
      title: "List a customer's standing orders",
      description:
        "List the standing orders (recurring items) of one SUMIT customer: what they are charged for, how much, " +
        "and the previous and next charge dates. Read-only. SUMIT has no account-wide list: call once per customer, and pace the calls. " +
        "There is no billing-interval field. The gap between Date_PreviousBilling and Date_NextBilling is only a hint: " +
        "an operator can move or skip a charge, and an order that was never charged has no previous date. Say the interval is unknown when unsure. " +
        "UnitPrice was before VAT on the one live account checked. To check an account, open the document of a past cycle with " +
        "sumit_get_document and compare the matching line item (same item, same quantity), not the document total: " +
        "one charge can cover several standing orders. " +
        `Each item has a Status: ${RECURRING_STATUS_VALUES} ` +
        "Status 3 and 14 mean a charge failed. Inactive items are left out unless includeInactive is set; " +
        "a cancelled item keeps its Date_NextBilling, which is not a charge that is due.",
      inputSchema: {
        ...accountField,
        customerId: z.string().describe("Numeric SUMIT customer ID. It is on every row of sumit_list_documents."),
        includeInactive: z.boolean().optional().describe("Also return cancelled, expired and disabled items. SUMIT leaves them out by default."),
      },
    },
    // The customer is addressed by ID with SearchMode None, as in document creation, so SUMIT
    // runs no search. Without an ID the Customer object would describe a new customer, so a
    // missing ID is refused here and never reaches the endpoint.
    async ({ account, customerId, includeInactive }) => {
      const id = parseCustomerId("sumit_list_customer_recurring", customerId);
      if (id === undefined) {
        throw new Error("sumit_list_customer_recurring: customerId is required.");
      }
      return ok(
        await call(
          "/billing/recurring/listforcustomer/",
          { Customer: { ID: id, SearchMode: 1 }, IncludeInactive: includeInactive },
          account,
        ),
      );
    },
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
