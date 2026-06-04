# Installation

`sumit-mcp` is a local MCP server (no public npm package yet). Clone, build, and connect.

## Build

```bash
git clone https://github.com/Digitizers/sumit-mcp.git
cd sumit-mcp
npm install
npm run build
```

## Get SUMIT credentials

In SUMIT (app.sumit.co.il) → developer/API settings, obtain your **CompanyID** and a server-side **APIKey**. The APIKey is a secret — keep it in env, never in chat or git.

## Connect (Claude Code)

`claude mcp add sumit -- node /absolute/path/to/sumit-mcp/dist/index.js` then set env, or use `.mcp.json` (copy `.mcp.json.example`):

```json
{
  "mcpServers": {
    "sumit": {
      "command": "node",
      "args": ["/absolute/path/to/sumit-mcp/dist/index.js"],
      "env": {
        "SUMIT_DEFAULT_ACCOUNT": "main",
        "SUMIT_MAIN_COMPANY_ID": "123",
        "SUMIT_MAIN_API_KEY": "your-api-key",
        "SUMIT_ALLOW_CHARGE": "0",
        "SUMIT_MAX_CHARGE": "5000",
        "SUMIT_CONFIRM_SECRET": "a-long-random-string"
      }
    }
  }
}
```

- Keep `SUMIT_ALLOW_CHARGE=0` until you intend to move money; flip to `1` to enable charge tools.
- `SUMIT_CONFIRM_SECRET` should be a fixed random string so confirmation tokens stay valid for the process lifetime.

## Multiple accounts

Add another pair, e.g. `SUMIT_SHOP_COMPANY_ID` / `SUMIT_SHOP_API_KEY`, then pass `account: "shop"` to any tool.

## Verify

Call `sumit_list_documents` — a successful list confirms credentials and connectivity.
