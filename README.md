# mcp-google-reader

MCP server that reads Google Docs and Google Sheets content for AI assistants like Claude.

Paste a Google Docs/Sheets link in your message — Claude reads it directly. No more copy-pasting PRDs, tech specs, or test case spreadsheets.

## Prerequisites

- **Node.js 18+** (recommended: [Node.js 20 or 22 LTS](https://nodejs.org/))
- A Google Cloud project with Docs & Sheets APIs enabled

## Quick Start

```bash
# 1. Set up Google Cloud OAuth (see detailed steps below)
# 2. Authorize (run in your terminal, not inside an AI assistant)
npx mcp-google-reader auth
# 3. Add to your MCP client
claude mcp add -s user google-reader -- npx mcp-google-reader serve
```

## Features

- **Google Docs → Markdown**: Preserves headings, bold, italic, lists, tables, links
- **Google Sheets → Markdown table**: First row as header, proper column alignment
- **Multiple URLs**: Paste several links in one message — all fetched in parallel
- **Sheet selection**: Read specific tabs by name, or all tabs at once
- **Caching**: 60-second in-memory cache to avoid redundant API calls
- **OAuth2**: Reads any file you have access to in your Google account

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com) → Create a new project (or select existing)
2. Enable **Google Docs API**: [Enable here](https://console.cloud.google.com/apis/library/docs.googleapis.com)
3. Enable **Google Sheets API**: [Enable here](https://console.cloud.google.com/apis/library/sheets.googleapis.com)

### 2. OAuth Consent Screen

1. Go to [APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Choose **External** → Create
3. Fill in:
   - App name: `mcp-google-reader`
   - User support email: your email
   - Developer contact: your email
4. **Scopes** → Save and Continue (no changes needed)
5. **Test users** → **Add users** → add your Google email → Save and Continue
6. **Summary** → Back to Dashboard
7. Keep in **Testing** mode (sufficient for personal use and small teams)

### 3. Create OAuth Client ID

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name: `mcp-google-reader`
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### 4. Authorize

> **Important**: Run this command in your **terminal** directly — not inside an AI assistant. The auth flow requires interactive input and opening a browser.

```bash
npx mcp-google-reader auth
```

This will:
1. Ask for your Client ID and Client Secret (first time only)
2. Print an authorization URL — **copy and open it in your browser**
3. Sign in with your Google account and click **Allow**
4. Browser redirects to localhost — tokens are saved automatically

Credentials stored at `~/.mcp-google-reader/`

> `npx` automatically downloads the package on first run — no `npm install -g` needed.
>
> **Windows troubleshooting**: If you get `sed: command not found` errors, try one of these:
> ```bash
> # Option 1: Run in Command Prompt (cmd) instead of PowerShell
> cmd /c "npx mcp-google-reader auth"
>
> # Option 2: Install globally first
> npm install -g mcp-google-reader
> mcp-google-reader auth
> ```

### 5. Add to your MCP client

#### Claude Code (CLI)

```bash
# Add globally (available in all projects)
claude mcp add -s user google-reader -- npx mcp-google-reader serve

# Or add to current project only
claude mcp add google-reader -- npx mcp-google-reader serve
```

Then **restart Claude Code** to load the MCP server.

#### Cursor / Windsurf / VS Code

Create a `.mcp.json` file in your project root (or copy from `.mcp-example.json`):

```json
{
  "mcpServers": {
    "google-reader": {
      "command": "npx",
      "args": ["mcp-google-reader", "serve"]
    }
  }
}
```

Then restart your editor.

#### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "google-reader": {
      "command": "npx",
      "args": ["mcp-google-reader", "serve"]
    }
  }
}
```

Config file location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

## Usage

Just paste Google links in your message:

```
Read this PRD and implement the feature:
https://docs.google.com/document/d/1abc123.../edit

Test cases are here:
https://docs.google.com/spreadsheets/d/1xyz789.../edit
```

Claude will automatically call `read_google_links` and get the content.

Multiple links in one message are supported:

```
Here are the PRD https://docs.google.com/document/d/abc and test cases https://docs.google.com/spreadsheets/d/xyz — please review both.
```

### Tools

#### `read_google_links`

Extract and read all Google Docs/Sheets URLs from a message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | Message containing one or more Google URLs |

#### `read_google_sheet`

Read a specific Google Sheet with fine-grained options.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Google Sheets URL |
| `sheet_name` | string | No | Tab name (default: first tab) |
| `range` | string | No | Cell range, e.g. `A1:Z100` |
| `all_sheets` | boolean | No | Read all tabs |

## Credentials

```
~/.mcp-google-reader/
├── oauth-config.json    # Client ID & Secret (created during auth)
└── credentials.json     # Access & refresh tokens (auto-managed)
```

## Security

- Credentials stored with `600` file permissions (owner read/write only)
- Tokens auto-refresh — no need to re-authorize
- Read-only scopes: `documents.readonly` and `spreadsheets.readonly`
- No data sent anywhere except Google APIs

## License

MIT
