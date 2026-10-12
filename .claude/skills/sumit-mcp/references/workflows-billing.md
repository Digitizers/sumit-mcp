# Billing workflows

## Accepted quote → invoice → send → track
1. `sumit_create_document` with `documentType: 12` (quote) for the customer + line items.
2. On acceptance, `sumit_create_document` with `documentType: 0` (invoice) — reuse the same `customerExternalId` so SUMIT matches the customer.
3. `sumit_send_document` to email it.
4. Later, to see whether it was paid: list the open documents of the type you issued (`documentType: 0` for the invoice in step 2), as described under "What a customer owes" below.

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
Start from the open documents, not from the debt tools.

1. List the documents of the kind the business bills with: `sumit_list_documents` with `documentType: 3` for proformas (חשבון עסקה), `documentType: 0` for tax invoices, and a `fromDate` far enough back.
2. Read every page. The tool returns one page per call, 10 rows unless `pageSize` says otherwise. While `HasNextPage` is true, call again with `startIndex` advanced by the number of rows received. A sum over the first page alone misses documents.
3. Keep the rows with `IsClosed: false` and `IsDraft: false`. The endpoint has no filter for either, and none for the customer, so filter the result. Match the customer by `CustomerID`.
4. `DocumentValue` on a row is the full value of the document, VAT included. It is the amount owed only when nothing has been paid against that document yet.

What an open document does and does not tell you:

- **It is still owed, in whole or in part.** That much held on a live account that bills by proforma, checked on 2026-10-13: one customer's only open proforma was exactly what they owed, and the owner confirmed that the open proformas across the account were the unpaid ones.
- **It does not give the remaining balance of a document paid in instalments.** SUMIT's own procedure for partial payments keeps the original proforma open, with its full value, until the last instalment. On such a document the row overstates what is left. Open it with `sumit_get_document` and look for payments recorded against it before quoting a balance, and if the document does not settle it, give the full value as an upper bound and say so.
- Some businesses issue a separate proforma for each part of a deal instead. Then the paid part is a closed document and the open one is the balance. That is how the account above works, and it is a property of that account, not of SUMIT. Ask the user which way they bill before adding up.
- For tax invoices (`documentType: 0`) the same flags are on the row, but this has not been checked against a live account.
- The same listing without the customer filter answers "who has open documents", with the customer name on each row.

Standing orders are a second list. A customer on a standing order (הוראת קבע) is charged for recurring items and has no open document for them, so the open documents do not show what they pay or when the order ends. No tool reads standing orders yet (SUMIT's endpoint is per customer; see issue #22): say so, and send the user to the standing-orders list in SUMIT, instead of answering from documents alone.

The debt tools did not give the amount owed on the account above:

- `sumit_get_customer_debt` computes debit documents minus credit documents, and the caller names both kinds. For the customer with one open proforma it returned, for six pairs: roughly the total of every proforma ever issued to them, paid ones included (`2`/`4`, `5`/`4`, `2`/`1`); zero (`1`/`4`); and two negative numbers (`6`/`4`, `1`/`2`). On that account the payments that close a proforma are not counted as `Receipt`.
- `sumit_get_debt_report` takes the same two sources. With `2`/`4` it showed customers with an open proforma with a negative balance.
- So do not tell anyone what they owe from a debt tool alone. If you use one, check the number against the customer's open documents first. On an account that bills by tax invoice and records payment by plain receipt, `1`/`4` is the pair to try; that has not been checked against a live account.

## Reconcile debts
- List the open documents as above → for each one, `sumit_get_document` to inspect it, then `sumit_send_document` as a reminder. Sending needs the user's approval each time.
