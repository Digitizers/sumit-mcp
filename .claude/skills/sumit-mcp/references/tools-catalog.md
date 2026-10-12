# Tools catalog (14)

Legend: **R** read-only · **W** write (no money) · **$** money movement.

## Read (R)
- `sumit_list_documents` — list documents by date/type, one page per call (`startIndex`, `pageSize`). No customer filter exists.
- `sumit_get_document` — one document's details (by ID or type+number).
- `sumit_get_document_pdf` — document PDF (URL/base64).
- `sumit_get_customer_debt` — outstanding debt for one customer, by its numeric SUMIT `customerId` (required; the endpoint has no lookup by external identifier). `debitSource` and `creditSource` are required too: which documents count as debt and which settle it (1 tax invoice, 2 proforma, 3 payment request, 4 receipt, 5 proforma + payment request, 6 proforma + payment request + tax invoice). There is no default, because a wrong pair returns a number that looks right.
- `sumit_get_debt_report` — debt across all customers.
- `sumit_list_income_items` — catalog/income items.
- `sumit_get_customer_url` — link to a customer's SUMIT page (no raw-export endpoint exists).

## Write (W)
- `sumit_create_document` — issue a document (see types below). No card charge. `vatIncluded` is required: `false` when the unit prices are before VAT (SUMIT adds it), `true` when they already include it. `isDraft: true` saves a draft instead of issuing it. `customerId` bills an existing customer by its SUMIT ID. Every item name that is not in the catalog yet is added to it.
- `sumit_send_document` — email an existing document.
- `sumit_cancel_document` — cancel/credit a document.
- `sumit_upsert_customer` — create/update a customer (by ExternalIdentifier).
- `sumit_create_income_item` — create a catalog item.

## Charge ($)
- `sumit_prepare_charge` — preview + mint confirmation token. No money moves.
- `sumit_execute_charge` — perform the charge. Needs `SUMIT_ALLOW_CHARGE=1`, the confirmation token, and a browser `single_use_token`. Bound to the prepared amount/customer; capped by `SUMIT_MAX_CHARGE`.

## SUMIT document types
| Code | Document | Hebrew |
| --- | --- | --- |
| 0 | Tax Invoice | חשבונית מס |
| 1 | Invoice-Receipt | חשבונית מס-קבלה |
| 2 | Receipt | קבלה |
| 3 | Proforma | חשבון עסקה |
| 12 | Price Quotation | הצעת מחיר |

> Note: SUMIT exposes no "list/search customers" or "list payments" data endpoint. Customer state comes from debt tools + `getdetailsurl`; payment outcome comes from the charge response. Agent-initiated charging requires a browser-minted one-time `single_use_token` (SUMIT does not accept a stored card reference from this server).
