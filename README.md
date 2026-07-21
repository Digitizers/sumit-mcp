# SUMIT MCP — Claude Code & OpenClaw Skill

[![CI](https://github.com/Digitizers/sumit-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Digitizers/sumit-mcp/actions/workflows/ci.yml)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-skill-d97757)](https://docs.claude.com/en/docs/claude-code)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-skill-purple)](https://github.com/Digitizers)
[![SUMIT](https://img.shields.io/badge/SUMIT-billing-0a7cff)](https://sumit.co.il)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

> An MCP server that turns SUMIT (formerly OfficeGuy) into agent-operable Israeli billing — read invoices and debt, issue חשבונית/קבלה/חשבון עסקה, and charge with a confirm-first safety model. The operational playbook for billing your clients from Claude Code or OpenClaw.

## Features

- ✅ **14 tools** across read (invoices, debt, catalog), write (issue/send/cancel documents, customers), and charge.
- ✅ **Layered charge safety** — env opt-in, prepare→execute confirmation token, amount cap, redacted audit. Money never moves silently.
- ✅ **Multi-account** via env; pick the account per call.
- ✅ Built on the in-house `sumit-api` library (battle-tested payload builders + redaction).
- ✅ Local stdio server — no secrets leave your machine.

## Quick start

See [`.claude/skills/sumit-mcp/references/installation.md`](.claude/skills/sumit-mcp/references/installation.md): clone, `pnpm install && pnpm build`, set `SUMIT_*` env, connect via `claude mcp add` or `.mcp.json`.

The committed [`.mcp.json`](.mcp.json) holds env-var placeholders only and runs the committed `dist/bundle.mjs`, so it works both as the plugin's MCP config (`${CLAUDE_PLUGIN_ROOT}` set by the plugin cache) and straight from a clone — including claude.ai cloud sessions, where the `SUMIT_*` values come from the cloud environment's env vars. Without `SUMIT_MAIN_COMPANY_ID`/`SUMIT_MAIN_API_KEY` set, the server simply doesn't start; charging additionally stays behind its own env opt-ins (below).

## Safety

Charging requires `SUMIT_ALLOW_CHARGE=1`, always goes prepare → user approval → execute, and needs a browser-minted one-time card token. See the skill's safety ladder. Set `SUMIT_CONFIRM_SECRET` to a fixed random value (e.g. `openssl rand -hex 32`); charging refuses to run without it.

The full threat model — what a misbehaving agent could try and which control stops it — is in [SECURITY.md](SECURITY.md).

## Links

- SUMIT API: <https://app.sumit.co.il/developers/api/>
- Companion runtime libs: [`sumit-api`](https://github.com/Digitizers/sumit-api), [`sumit-react`](https://github.com/Digitizers/sumit-react)

---

Built with ❤️ for OpenClaw by [Digitizer](https://www.digitizer.studio)

### Windows note

The plugin ships its skill through a git **symlink** (`skills/` → the in-repo
source). On Windows, enable Developer Mode and set
`git config --global core.symlinks true` **before** cloning or installing —
the plugin cache clone inherits it. Changing the config does not repair an
existing checkout (the repo may have recorded `core.symlinks=false` locally).
To repair one, run these two commands inside it (the second re-materializes
only the plugin's symlink entry, so nothing else in your working tree is
touched):

    git config core.symlinks true
    git checkout -- skills/sumit-mcp

Or simply re-clone. WSL also works. macOS/Linux need nothing.
