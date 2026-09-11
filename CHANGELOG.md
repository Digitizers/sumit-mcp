# Changelog

## Unreleased

### Fixed

- `src/client.ts`: the live SUMIT API returns a **numeric** `Status` (`0` success, `1` user error, `2` bad request), not the string `"Success"`. Both `sumitPost` and `sumitPostRaw` treated every successful call as a failure and threw the generic `"SUMIT request failed"`, discarding the data. A numeric `Status` with no `UserErrorMessage` also crashed the redactor with a `TypeError`. The string form is still accepted for forward-compatibility. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
- `sumit_get_debt_report` posted an empty body to `/accounting/documents/getdebtreport/`, which always failed with `שדה חסר: DebitSource`. It now sends `DebitSource: 1` / `CreditSource: 2` by default and exposes both as optional numeric parameters. ([#4](https://github.com/Digitizers/sumit-mcp/issues/4))
- Test fixtures now mock the numeric envelope the API actually produces, so the suite can no longer stay green against a shape that never ships.

## 1.0.0 — 2026-06-05

Initial release.

- MCP server (stdio) for SUMIT billing built on `sumit-api`.
- 7 read, 5 write, 2 charge tools.
- Layered charge safety: `SUMIT_ALLOW_CHARGE` gate, prepare→execute confirmation token, `SUMIT_MAX_CHARGE` cap, redacted audit log.
- Multi-account env configuration.
