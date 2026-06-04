# Changelog

## 1.0.0 — 2026-06-05

Initial release.

- MCP server (stdio) for SUMIT billing built on `sumit-api`.
- 7 read, 5 write, 2 charge tools.
- Layered charge safety: `SUMIT_ALLOW_CHARGE` gate, prepare→execute confirmation token, `SUMIT_MAX_CHARGE` cap, redacted audit log.
- Multi-account env configuration.
