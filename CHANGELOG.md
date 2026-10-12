# Changelog

## Unreleased

### Added

- `sumit_list_customer_recurring`: a read tool for the standing orders (recurring items) of one customer, by numeric SUMIT customer ID. Until now the server could create a recurring charge but could not show what already exists. SUMIT has no account-wide list, so it is one call per customer. ([#22](https://github.com/Digitizers/sumit-mcp/issues/22))
- `sumit_create_document` takes `isDraft`, which saves the document as a draft in SUMIT instead of issuing it. A draft cannot be combined with `sendByEmail`; the tool refuses before calling SUMIT.
- `sumit_create_document` takes `customerId`, the numeric SUMIT ID of an existing customer. Until now the tool could address a customer only by `customerExternalId` or by name, so billing a customer that was created in SUMIT's own interface (no external identifier) left the match to SUMIT's automatic search. The ID is sent as a number, as SUMIT's schema types it, with `SearchMode` None.

### Changed

- **Breaking for callers:** `sumit_create_document` requires `vatIncluded`. It was optional, and an omitted flag was sent to SUMIT as `VATIncluded: true` (the default of `sumit-api` 0.4, the opposite of SUMIT's own). Prices given before VAT then produced a document whose total left the VAT out, with no error. The tool now refuses a call without the flag, in the input schema and again in the handler. ([#15](https://github.com/Digitizers/sumit-mcp/issues/15))
- **Breaking for callers:** `sumit_get_customer_debt` requires `customerId`, `debitSource` and `creditSource`, and no longer accepts `externalIdentifier`. SUMIT's request has no such field and ignores unknown ones, so a lookup by external identifier could never have worked. The two sources have no default: the debt is one kind of document minus another, and a pair that does not match how the business bills returns a plausible but wrong balance. ([#14](https://github.com/Digitizers/sumit-mcp/issues/14))

- **Breaking for callers:** `sumit_get_debt_report` requires `debitSource` and `creditSource` (1 to 6). It defaulted to 1 and 2, which is tax invoices minus proformas, not minus receipts, so paid invoices were reported as owed and nothing failed. No pair fits every account. ([#17](https://github.com/Digitizers/sumit-mcp/issues/17))

- `sumit-api` 0.4.1 → 0.5.0. That release sends `Customer.ID` as a number by itself, so the workaround in `sumit_create_document` that rewrote the ID after the payload was built is gone. The request sent to SUMIT is unchanged.
- The charge tools state that prices are VAT-inclusive, and pass that to `sumit-api` explicitly (0.5.0 requires the flag). This is what they always did, through the library's old default. It is fixed, not an input: the approved amount, the confirmation token and the cap are all computed from `unitPrice`, so SUMIT must not add VAT on top of it.

### Documentation

- The skill's billing workflows now answer "what does a customer owe" from the open documents (`sumit_list_documents`, every page, `IsClosed: false`) instead of from the debt tools, and say what an open document does not tell: the remaining balance of a document paid in instalments. A check against a live account on 2026-10-13 found that `sumit_get_customer_debt` returned a number other than the amount owed for all six debit and credit pairs tried, and that the debt report showed customers with an open proforma with a negative balance.
- The skill says that standing orders are a second list, read with `sumit_list_customer_recurring`, and that every document kind the business bills with has to be listed (proformas, tax invoices, payment requests).
- `sumit_list_customer_recurring` and the skill say how to read a standing order, after the first live run: `UnitPrice` was before VAT on the account checked (a document includes VAT), the billing cycle is `Item.Duration_Months` / `Item.Duration_Days` when non-zero, zero in both does not mean monthly (the gap between the two billing dates is then only a hint), and a cancelled item keeps its `Date_NextBilling`. The VAT treatment of an account is checked on the matching line of a past document, not on the document total. The description no longer says the tool shows "how often" a customer is charged. ([#24](https://github.com/Digitizers/sumit-mcp/issues/24))

### Fixed

- `sumit_get_customer_debt` failed on every call with `שדה חסר: DebitSource`. It now sends `DebitSource` / `CreditSource` as the caller chose them, sends `CustomerID` as a number and rejects a non-numeric one before the request, and takes `includeDraftDocuments`. ([#14](https://github.com/Digitizers/sumit-mcp/issues/14))
- The description of `sumit_create_document` and the skill now say that every item name that is not in the SUMIT catalog is added to it, and how to avoid that for recurring services. ([#15](https://github.com/Digitizers/sumit-mcp/issues/15))
- `src/client.ts`: the live SUMIT API returns a **numeric** `Status` (`0` success, `1` user error, `2` bad request), not the string `"Success"`. Both `sumitPost` and `sumitPostRaw` treated every successful call as a failure and threw the generic `"SUMIT request failed"`, discarding the data. A numeric `Status` with no `UserErrorMessage` also crashed the redactor with a `TypeError`. The string form is still accepted for forward-compatibility. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
- `sumit_get_debt_report` posted an empty body to `/accounting/documents/getdebtreport/`, which always failed with `שדה חסר: DebitSource`. It now sends `DebitSource: 1` / `CreditSource: 2` by default and exposes both as optional numeric parameters. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
- The installed plugin never connected. `.mcp.json` launched `${CLAUDE_PLUGIN_ROOT:-.}/dist/bundle.mjs`, and Claude Code resolves that form to `./dist/bundle.mjs` for a plugin, so the server was looked up in the session's working directory and failed with `Cannot find module`. The plugin manifest now declares the server itself with `${CLAUDE_PLUGIN_ROOT}/dist/bundle.mjs`; `.mcp.json` is unchanged and still serves a clone opened at the repo root.
- An unset credential did not stop the server. Claude Code passes an unset `${VAR}` through as literal text, so with only the company ID set the placeholder was accepted as the API key and sent to SUMIT, and with nothing set the server started with zero accounts and failed on every call. `loadAccounts` now ignores unexpanded placeholders and the server exits at startup when no usable account is configured.
- `sumit_list_documents` sent `FromDate` / `ToDate` / `Type` / `CustomerID` / `Page`, none of which exist on `Accounting_Documents_List_Request`. SUMIT ignores unknown fields, so every call returned the same unfiltered first page with `HasNextPage: true`. It now sends `DateFrom`, `DateTo`, `DocumentTypes` and `Paging { StartIndex, PageSize }`. **Breaking for callers:** `page` is replaced by `startIndex` / `pageSize`, and `customerId` is removed because the endpoint has no customer filter.
- `sumit_get_document` sent `Type` / `Number` for the type-plus-number lookup; the endpoint reads `DocumentType` / `DocumentNumber`. Lookup by `documentId` was unaffected.
- Test fixtures now mock the numeric envelope the API actually produces, so the suite can no longer stay green against a shape that never ships.

### Security

- `@modelcontextprotocol/sdk` 1.30.0 → 1.32.1, and the range raised to `^1.31.0`, the first release without GHSA-6qxp-vccf-f47h (its OAuth client could send credentials to an authorization server chosen by the MCP server). Lockfile refreshed for four transitive advisories: `proxy-addr` 2.0.8, `fast-uri` 3.1.8, `ip-address` 10.7.3, `source-map-js` 1.2.2. Of these, only `fast-uri` is compiled into the shipped bundle; this stdio-only server does not load the OAuth client or the HTTP transport stack.
- Refreshed the lockfile to clear 21 Dependabot advisories (8 high): `fast-uri` ×6, `ip-address` ×3, `hono` ×7, `@hono/node-server`, `qs` ×2 (all transitive via `@modelcontextprotocol/sdk`'s HTTP transport stack, which this stdio-only server never starts) and `postcss` ×2 (dev, via Vite). `pnpm audit` is clean.
- `@modelcontextprotocol/sdk` 1.29.0 → 1.30.0 and `sumit-api` 0.4.0 → 0.4.1, both within existing ranges.

## 1.0.0 — 2026-06-05

Initial release.

- MCP server (stdio) for SUMIT billing built on `sumit-api`.
- 7 read, 5 write, 2 charge tools.
- Layered charge safety: `SUMIT_ALLOW_CHARGE` gate, prepare→execute confirmation token, `SUMIT_MAX_CHARGE` cap, redacted audit log.
- Multi-account env configuration.
