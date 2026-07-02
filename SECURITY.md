# Security

This server can move real money. This document describes what an attacker (including a misbehaving or prompt-injected agent) could try, and which control stops it. Every claim below is implemented in [`src/safety.ts`](src/safety.ts) and [`src/tools/charge.ts`](src/tools/charge.ts) and exercised by the tests in [`test/safety.test.ts`](test/safety.test.ts) and [`test/charge.test.ts`](test/charge.test.ts).

## Threat model

| Scenario | Defense |
| --- | --- |
| Agent tries to charge without the operator opting in | `sumit_execute_charge` refuses unless the server env sets `SUMIT_ALLOW_CHARGE=1`. Read and document tools work without it; money movement is a separate, explicit opt-in. |
| Agent skips `sumit_prepare_charge` or fabricates a confirmation token | Execute requires a token HMAC-SHA256-signed with `SUMIT_CONFIRM_SECRET`. Signature verification is timing-safe, and tokens with an unknown nonce are rejected. Charging also refuses to run when `SUMIT_CONFIRM_SECRET` is unset or left at a placeholder value, so there is no guessable default. |
| Replay: executing the same approved charge twice | The token nonce is consumed on first successful verification (single-use). A second execute with the same token fails with "unknown or already used". |
| Charge drift: user approves one thing, agent executes another | The token is cryptographically bound to account, customer, amount, currency, and a hash of the line item. Any mismatch between prepare and execute throws before the API call. |
| Stale approval reused much later | Confirmation tokens expire 5 minutes after prepare. The nonce store is in-memory, so a server restart also invalidates all outstanding tokens (fails closed). |
| Runaway amount | `SUMIT_MAX_CHARGE` caps the amount at both prepare and execute. A malformed or unset cap fails closed to a 5000 default — it never becomes "unlimited". |
| Agent mints a card token itself | It cannot. `sumit_execute_charge` requires a `singleUseToken` produced by a real SUMIT browser checkout; card data never passes through the agent or this server. |
| Secrets or card data leaking into logs | Every prepare/execute writes an audit line that passes through the redaction layer (backed by `sumit-api`'s redactors), and the account API key is scrubbed from thrown error messages. |

## Scope

This is a local stdio MCP server. Credentials live in the server process env and are sent only to `api.sumit.co.il`; nothing is proxied through third parties.

## Reporting a vulnerability

Please report privately via [GitHub security advisories](https://github.com/Digitizers/sumit-mcp/security/advisories/new) rather than a public issue.
