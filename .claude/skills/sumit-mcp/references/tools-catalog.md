# Tools catalog (15)

Legend: **R** read-only · **W** write (no money) · **$** money movement.

## Read (R)
- `sumit_list_documents` — list documents by date/type, one page per call (`startIndex`, `pageSize`). No customer filter exists. Each row carries `IsClosed` and `IsDraft`. Open documents (`IsClosed: false`) are where "what does a customer owe" starts; follow `HasNextPage` to the last page before adding anything up.
- `sumit_get_document` — one document's details (by ID or type+number).
- `sumit_get_document_pdf` — document PDF (URL/base64).
- `sumit_get_customer_debt` — outstanding debt for one customer, by its numeric SUMIT `customerId` (required; the endpoint has no lookup by external identifier). `debitSource` and `creditSource` are required too: which documents count as debt and which settle it (1 tax invoice, 2 proforma, 3 payment request, 4 receipt, 5 proforma + payment request, 6 proforma + payment request + tax invoice). There is no default, because a wrong pair returns a number that looks right.
- `sumit_get_debt_report` — one balance per customer ID, across all customers, without names. `debitSource` and `creditSource` are required, with the same six values and the same caution as `sumit_get_customer_debt`.
- `sumit_list_customer_recurring` — the standing orders (recurring items) of one customer, by numeric `customerId`: item, unit price, previous and next charge dates, and a `Status` (0 active, 1 cancelled, 3 disabled after a failed payment, 9 finished, 11 grace period, 12 pending first payment, 13 cancelled by the customer, 14 pending retry). `includeInactive: true` adds the ones that are no longer active. There is no account-wide list; call once per customer. The response has no interval field (the gap between `Date_PreviousBilling` and `Date_NextBilling` is a hint, not the configured cycle), and `UnitPrice` was before VAT on the one live account checked; see "What a customer owes" in `workflows-billing.md`.
- `sumit_list_income_items` — catalog/income items.
- `sumit_get_customer_url` — link to a customer's SUMIT page (no raw-export endpoint exists).

## Write (W)
- `sumit_create_document` — issue a document (see types below). No card charge. `vatIncluded` is required: `false` when the unit prices are before VAT (SUMIT adds it), `true` when they already include it. `isDraft: true` saves a draft instead of issuing it. `customerId` bills an existing customer by its SUMIT ID. Every item name that is not in the catalog yet is added to it.
- `sumit_send_document` — email an existing document.
- `sumit_cancel_document` — cancel/credit a document.
- `sumit_upsert_customer` — create/update a customer (by ExternalIdentifier).
- `sumit_create_income_item` — create a catalog item.

## Charge ($)
- `sumit_prepare_charge` — preview + mint confirmation token. No money moves. Prices are VAT-inclusive: `unitPrice` is the amount charged, and SUMIT adds nothing on top.
- `sumit_execute_charge` — perform the charge. Needs `SUMIT_ALLOW_CHARGE=1`, the confirmation token, and a browser `single_use_token`. Bound to the prepared amount/customer; capped by `SUMIT_MAX_CHARGE`.

## SUMIT document types
| Code | Document | Hebrew |
| --- | --- | --- |
| 0 | Tax Invoice | חשבונית מס |
| 1 | Invoice-Receipt | חשבונית מס-קבלה |
| 2 | Receipt | קבלה |
| 3 | Proforma | חשבון עסקה |
| 12 | Price Quotation | הצעת מחיר |

> Note: SUMIT exposes no "list/search customers" or "list payments" data endpoint. What a customer owes comes from their open documents (`sumit_list_documents`) and their standing orders (`sumit_list_customer_recurring`), not from the debt tools alone; `getdetailsurl` links to the customer's page; payment outcome comes from the charge response. Agent-initiated charging requires a browser-minted one-time `single_use_token` (SUMIT does not accept a stored card reference from this server).
