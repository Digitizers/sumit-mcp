# Billing workflows

## Accepted quote → invoice → send → track
1. `sumit_create_document` with `documentType: 12` (quote) for the customer + line items.
2. On acceptance, `sumit_create_document` with `documentType: 0` (invoice) — reuse the same `customerExternalId` so SUMIT matches the customer.
3. `sumit_send_document` to email it.
4. Later, to see who still owes: the open documents, as described under "What a customer owes" below.

## Bill a customer that already exists in SUMIT
1. Find the customer's `CustomerID`: it is on every row of `sumit_list_documents`, and on `sumit_get_document`.
2. `sumit_create_document` with that `customerId`. SUMIT bills the existing customer and no lookup runs. Without `customerId` or `customerExternalId` SUMIT matches on the other fields and may create a second customer with the same name.
3. To let the user review before anything is issued, add `isDraft: true`. A draft cannot be emailed from the tool; the user issues it in SUMIT.
4. A proforma (`documentType: 3`, חשבון עסקה) is the document to prefer when the customer should pay by themselves: it carries a payment link and is not a tax invoice.

## Prices and VAT on a document
- `vatIncluded` has no default and the tool refuses a call without it. Price lists quoted "+ מע\"מ" are before VAT: pass `vatIncluded: false`, and SUMIT adds VAT on top. Pass `true` only when the unit prices are the amounts the customer pays.
- Check the result: read the document back (`sumit_get_document`, or its row in `sumit_list_documents`) and compare `DocumentValue`, which includes VAT, with the total you expect. Do this before a draft is issued or a document is sent.
- A wrong flag does not fail. With `true` on prices that were meant to be before VAT, the total equals the sum of the lines and the VAT is carved out of it.

## Item names and the catalog
- Each `items[].name` that does not match an existing income item is added to the SUMIT catalog. A document with four one-off descriptive names leaves four catalog items behind.
- For a recurring service, take the name from `sumit_list_income_items` and reuse it exactly. Put the one-off detail (dates, quantities, what the hours were for) in `description`.

## Monthly retainer (recurring charge)
1. `sumit_prepare_charge` with `mode: "recurring"`, the customer, the monthly `item` (`durationMonths: 1`), and currency. Read the returned summary aloud to the user.
2. Get explicit approval. Have the user complete a SUMIT checkout to produce a one-time `single_use_token`.
3. `sumit_execute_charge` with the `confirmationToken` + `singleUseToken`. The normalized event reports `recurring.charged` on success.

## What a customer owes
Start from the documents, not from the debt tools.

- **A business that bills by proforma (חשבון עסקה):** what a customer owes is the sum of their open proformas. Call `sumit_list_documents` with `documentType: 3` and a `fromDate` far enough back, then keep the rows with `IsClosed: false` and `IsDraft: false` for that `CustomerID`. The endpoint has no filter for either, so filter the result. `DocumentValue` includes VAT.
- A deal paid in parts shows up as it should: the part that was paid is a closed proforma, the part still owed is an open one.
- The same call without the customer filter answers "who owes money": every open proforma, with the customer name on the row.
- Checked against a live account on 2026-10-13: a customer with one open proforma had exactly that amount owed, and the open proformas across the account matched what the owner knew was unpaid.

The debt tools did not give that answer on the same account:

- `sumit_get_customer_debt` computes debit documents minus credit documents, and the caller names both kinds. For the customer above it returned, for six pairs: roughly the total of every proforma ever issued to them, paid ones included (`2`/`4`, `5`/`4`, `2`/`1`); zero (`1`/`4`); and two negative numbers (`6`/`4`, `1`/`2`). None was the amount owed. On that account the payments that close a proforma are not counted as `Receipt`.
- `sumit_get_debt_report` takes the same two sources. With `2`/`4` it showed customers who still owed half of a deal with a negative balance.
- So do not tell anyone what they owe from a debt tool alone. If you use one, check the number against the customer's open documents first. On an account that bills by tax invoice and records payment by plain receipt, `1`/`4` is the pair to try; that has not been checked against a live account.

## Reconcile debts
- `sumit_list_documents` with `documentType: 3`, keep `IsClosed: false` → for each open proforma, `sumit_get_document` to inspect it, then `sumit_send_document` as a reminder. Sending needs the user's approval each time.
