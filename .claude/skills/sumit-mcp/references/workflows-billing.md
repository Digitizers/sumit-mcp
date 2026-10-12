# Billing workflows

## Accepted quote → invoice → send → track
1. `sumit_create_document` with `documentType: 12` (quote) for the customer + line items.
2. On acceptance, `sumit_create_document` with `documentType: 0` (invoice) — reuse the same `customerExternalId` so SUMIT matches the customer.
3. `sumit_send_document` to email it.
4. Later, `sumit_get_customer_debt` (one customer) or `sumit_get_debt_report` (all) to see who still owes.

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
- `sumit_get_customer_debt` computes debit documents minus credit documents, and the caller names both kinds. Ask how the business bills before choosing. Going by the names in SUMIT's enum, tax invoice then receipt would be `debitSource: 1`, `creditSource: 4`, and proforma (חשבון עסקה) then receipt `debitSource: 2`, `creditSource: 4`; neither reading has been confirmed against a customer whose balance is known.
- A pair that does not match the bookkeeping still returns a number: invoices that were paid show as owed, or the balance comes out negative. Treat a surprising result as a wrong pair first, and check it against the customer's documents (`sumit_list_documents`) before telling anyone what they owe.

## Reconcile debts
- `sumit_get_debt_report` → for each debtor, `sumit_get_document` to inspect the open invoice, then `sumit_send_document` as a reminder.
