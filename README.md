# mcp-google-reader

MCP server that reads Google Docs and Google Sheets content for AI assistants like Claude.

Paste a Google Docs/Sheets link in your message — Claude reads it directly. No more copy-pasting PRDs, tech specs, or test case spreadsheets.

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
4. Save and Continue through all steps
5. Go to **Test users** → **Add users** → add your Google email
6. Keep in **Testing** mode (sufficient for small teams)

### 3. Create OAuth Client ID

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Desktop app**
4. Name: `mcp-google-reader`
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### 4. Authorize

```bash
npx mcp-google-reader auth
```

This will:
- Ask for your Client ID and Client Secret (first time only, saved to `~/.mcp-google-reader/oauth-config.json`)
- Print an authorization URL — **copy and open it in your browser**
- After Google consent, browser redirects to localhost and tokens are saved
- Credentials stored at `~/.mcp-google-reader/credentials.json`

### 5. Add to Claude Code

```bash
# Add globally (available in all projects)
claude mcp add -s user google-reader -- npx mcp-google-reader serve

# Or add to current project only
claude mcp add google-reader -- npx mcp-google-reader serve
```

Then **restart Claude Code** to load the MCP server.

> No `npm install -g` needed — `npx` downloads and runs automatically.

## Usage

### In Claude Code

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
