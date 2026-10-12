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

## Monthly retainer (recurring charge)
1. `sumit_prepare_charge` with `mode: "recurring"`, the customer, the monthly `item` (`durationMonths: 1`), and currency. Read the returned summary aloud to the user.
2. Get explicit approval. Have the user complete a SUMIT checkout to produce a one-time `single_use_token`.
3. `sumit_execute_charge` with the `confirmationToken` + `singleUseToken`. The normalized event reports `recurring.charged` on success.

## Reconcile debts
- `sumit_get_debt_report` → for each debtor, `sumit_get_document` to inspect the open invoice, then `sumit_send_document` as a reminder.
