# Billing workflows

## Accepted quote → invoice → send → track
1. `sumit_create_document` with `documentType: 12` (quote) for the customer + line items.
2. On acceptance, `sumit_create_document` with `documentType: 0` (invoice) — reuse the same `customerExternalId` so SUMIT matches the customer.
3. `sumit_send_document` to email it.
4. Later, `sumit_get_customer_debt` (one customer) or `sumit_get_debt_report` (all) to see who still owes.

## Monthly retainer (recurring charge)
1. `sumit_prepare_charge` with `mode: "recurring"`, the customer, the monthly `item` (`durationMonths: 1`), and currency. Read the returned summary aloud to the user.
2. Get explicit approval. Have the user complete a SUMIT checkout to produce a one-time `single_use_token`.
3. `sumit_execute_charge` with the `confirmationToken` + `singleUseToken`. The normalized event reports `recurring.charged` on success.

## Reconcile debts
- `sumit_get_debt_report` → for each debtor, `sumit_get_document` to inspect the open invoice, then `sumit_send_document` as a reminder.
