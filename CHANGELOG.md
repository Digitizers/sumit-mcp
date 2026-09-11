# Changelog

## Unreleased

### Fixed

- `src/client.ts`: the live SUMIT API returns a **numeric** `Status` (`0` success, `1` user error, `2` bad request), not the string `"Success"`. Both `sumitPost` and `sumitPostRaw` treated every successful call as a failure and threw the generic `"SUMIT request failed"`, discarding the data. A numeric `Status` with no `UserErrorMessage` also crashed the redactor with a `TypeError`. The string form is still accepted for forward-compatibility. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
- `sumit_get_debt_report` posted an empty body to `/accounting/documents/getdebtreport/`, which always failed with `שדה חסר: DebitSource`. It now sends `DebitSource: 1` / `CreditSource: 2` by default and exposes both as optional numeric parameters. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
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
