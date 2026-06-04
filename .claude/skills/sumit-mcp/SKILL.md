---
name: sumit-mcp
version: 1.0.0
license: MIT
description: Operate SUMIT (formerly OfficeGuy) Israeli billing from an agent — read invoices, debt, and catalog items; issue invoices/receipts/quotes (חשבונית/קבלה/חשבון עסקה); and charge with a layered, confirm-first safety model. Use when the task mentions SUMIT, OfficeGuy, חשבונית, קבלה, invoicing, billing, retainers, or Israeli accounting documents.
---

# SUMIT MCP

Operational guide for the `sumit-mcp` server: read → write → charge, safety first.

## The safety ladder (read this first)

1. **Read** tools are always safe — start here to understand state (`sumit_list_documents`, `sumit_get_customer_debt`, `sumit_get_debt_report`).
2. **Write** tools create accounting artifacts but move **no money** (`sumit_create_document`, `sumit_send_document`, `sumit_upsert_customer`).
3. **Charge** tools move money and are gated:
   - The server must run with `SUMIT_ALLOW_CHARGE=1` or charge refuses.
   - **Always** `sumit_prepare_charge` → show the returned summary to the user → get explicit approval → `sumit_execute_charge` with the `confirmationToken`.
   - `sumit_execute_charge` also needs a `single_use_token` from a real SUMIT browser checkout — an agent cannot mint card tokens. Never ask the user to paste card data; have them complete a checkout and supply only the resulting one-time token.
   - Charges are capped (`SUMIT_MAX_CHARGE`) and bound to the prepared amount/customer — any drift is rejected.

## Accounts

Multi-account via env (`SUMIT_<NAME>_COMPANY_ID` + `SUMIT_<NAME>_API_KEY`). Every tool takes an optional `account`; it defaults to `SUMIT_DEFAULT_ACCOUNT`. Confirm which account before any write/charge. Never print the `APIKey`.

## Quick route

| Need | Tool | Reference |
| --- | --- | --- |
| Install / connect / get API key | — | references/installation.md |
| Full tool list + document types | — | references/tools-catalog.md |
| Quote→invoice→send, retainers, debt | — | references/workflows-billing.md |
