# Changelog

## Unreleased

### Added

- `sumit_create_document` takes `isDraft`, which saves the document as a draft in SUMIT instead of issuing it. A draft cannot be combined with `sendByEmail`; the tool refuses before calling SUMIT.
- `sumit_create_document` takes `customerId`, the numeric SUMIT ID of an existing customer. Until now the tool could address a customer only by `customerExternalId` or by name, so billing a customer that was created in SUMIT's own interface (no external identifier) left the match to SUMIT's automatic search. The ID is sent as a number, as SUMIT's schema types it, with `SearchMode` None.

### Fixed

- `src/client.ts`: the live SUMIT API returns a **numeric** `Status` (`0` success, `1` user error, `2` bad request), not the string `"Success"`. Both `sumitPost` and `sumitPostRaw` treated every successful call as a failure and threw the generic `"SUMIT request failed"`, discarding the data. A numeric `Status` with no `UserErrorMessage` also crashed the redactor with a `TypeError`. The string form is still accepted for forward-compatibility. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
- `sumit_get_debt_report` posted an empty body to `/accounting/documents/getdebtreport/`, which always failed with `שדה חסר: DebitSource`. It now sends `DebitSource: 1` / `CreditSource: 2` by default and exposes both as optional numeric parameters. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
- The installed plugin never connected. `.mcp.json` launched `${CLAUDE_PLUGIN_ROOT:-.}/dist/bundle.mjs`, and Claude Code resolves that form to `./dist/bundle.mjs` for a plugin, so the server was looked up in the session's working directory and failed with `Cannot find module`. The plugin manifest now declares the server itself with `${CLAUDE_PLUGIN_ROOT}/dist/bundle.mjs`; `.mcp.json` is unchanged and still serves a clone opened at the repo root.
- An unset credential did not stop the server. Claude Code passes an unset `${VAR}` through as literal text, so with only the company ID set the placeholder was accepted as the API key and sent to SUMIT, and with nothing set the server started with zero accounts and failed on every call. `loadAccounts` now ignores unexpanded placeholders and the server exits at startup when no usable account is configured.
- `sumit_list_documents` sent `FromDate` / `ToDate` / `Type` / `CustomerID` / `Page`, none of which exist on `Accounting_Documents_List_Request`. SUMIT ignores unknown fields, so every call returned the same unfiltered first page with `HasNextPage: true`. It now sends `DateFrom`, `DateTo`, `DocumentTypes` and `Paging { StartIndex, PageSize }`. **Breaking for callers:** `page` is replaced by `startIndex` / `pageSize`, and `customerId` is removed because the endpoint has no customer filter.
- `sumit_get_document` sent `Type` / `Number` for the type-plus-number lookup; the endpoint reads `DocumentType` / `DocumentNumber`. Lookup by `documentId` was unaffected.
- Test fixtures now mock the numeric envelope the API actually produces, so the suite can no longer stay green against a shape that never ships.

### Security

- Refreshed the lockfile to clear 21 Dependabot advisories (8 high): `fast-uri` ×6, `ip-address` ×3, `hono` ×7, `@hono/node-server`, `qs` ×2 (all transitive via `@modelcontextprotocol/sdk`'s HTTP transport stack, which this stdio-only server never starts) and `postcss` ×2 (dev, via Vite). `pnpm audit` is clean.
- `@modelcontextprotocol/sdk` 1.29.0 → 1.30.0 and `sumit-api` 0.4.0 → 0.4.1, both within existing ranges.

## 1.0.0 — 2026-06-05

Initial release.

- MCP server (stdio) for SUMIT billing built on `sumit-api`.
- 7 read, 5 write, 2 charge tools.
- Layered charge safety: `SUMIT_ALLOW_CHARGE` gate, prepare→execute confirmation token, `SUMIT_MAX_CHARGE` cap, redacted audit log.
- Multi-account env configuration.
