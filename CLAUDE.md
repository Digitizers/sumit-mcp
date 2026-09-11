# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project

`sumit-mcp` — local stdio MCP server that exposes SUMIT (formerly OfficeGuy) Israeli billing to agents: read invoices/debt/catalog, issue documents (חשבונית / קבלה / חשבון עסקה), and charge with a layered, confirm-first safety model. Ships a Claude Code skill in `.claude/skills/sumit-mcp/`.

Built on [`sumit-api`](https://github.com/Digitizers/sumit-api) (payload builders + redaction). Companion browser package: [`sumit-react`](https://github.com/Digitizers/sumit-react). Not published to npm — consumed as a cloned local server.

## Architecture

| Path | Role |
| --- | --- |
| `src/index.ts` | Server bootstrap; registers the tool groups. |
| `src/tools/read.ts` | 7 read-only tools (invoices, debt, catalog, customers). |
| `src/tools/write.ts` | 5 write tools (issue/send/cancel documents, customers). No money movement. |
| `src/tools/charge.ts` | `sumit_prepare_charge` / `sumit_execute_charge` — the only tools that move money. |
| `src/safety.ts` | Charge opt-in gate, amount cap, HMAC confirmation tokens (single-use, TTL, binding). |
| `src/redact.ts` | Log redaction layered on `sumit-api`'s redactors. |
| `src/accounts.ts` | Multi-account resolution from `SUMIT_*` env. |
| `src/client.ts` | HTTP client for `api.sumit.co.il`. |

## Conventions

- **Zod schema for every tool input.** Strict TypeScript, no `any`.
- **Tests live in `test/`** (Vitest). New behavior gets a test.
- The README's `**N tools**` claim is guarded by `test/readme.test.ts` — adding or removing a tool means updating the README number, or the suite fails.
- **Comments only explain WHY.** Don't restate what the code does.

## Security model

This server moves real money. The threat model lives in [SECURITY.md](SECURITY.md); every row there maps to code in `src/safety.ts` / `src/tools/charge.ts`. Non-negotiable rules:

1. **Never weaken `safety.ts`.** `verifyConfirmation` stays single-use, TTL-bound, and bound to account/customer/amount/currency/items; `assertChargeEnabled` keeps requiring `SUMIT_ALLOW_CHARGE=1`; the amount cap keeps failing closed.
2. **`sumit_execute_charge` refuses without a real `SUMIT_CONFIRM_SECRET`.** No fallback secret may ever satisfy it.
3. **Never log raw SUMIT payloads.** Audit lines and errors pass through redaction; the account API key is scrubbed from thrown messages.
4. **No personal identifiers or secret-shaped strings** in `src/` or `.claude/` — the CI `no-leak` job blocks them.

## Workflow

```bash
pnpm install
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit
pnpm build        # tsc → dist/
```

**Development needs Node 22** (`.nvmrc`, and what CI runs) — Vitest 5 refuses to start on Node 20. The published `engines` field stays `>=20` because that is the *server's* runtime floor, not the test toolchain's.

Branches: `fix/*`, `feat/*`, `chore/*`. PRs to `main`. Conventional-commit-ish messages.
