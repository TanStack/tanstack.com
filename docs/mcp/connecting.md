---
id: connecting
title: Connecting
---

The TanStack MCP Server is available at `https://tanstack.com/api/mcp` and uses the Streamable HTTP transport.

## Authentication Options

There are two ways to authenticate with the TanStack MCP server:

### OAuth (Recommended)

MCP clients that support OAuth can authenticate automatically. Just use the server URL and your client will open a browser window to authorize access:

```
https://tanstack.com/api/mcp
```

No API key needed. Your client handles the OAuth flow automatically.

### API Keys

For clients that don't support OAuth, or if you prefer manual key management:

1. [Sign in to your TanStack account](/login)
2. Go to [Integrations](/account/integrations)
3. Click "New Key" and give it a descriptive name
4. Copy the key immediately (you won't see it again)

> [!NOTE]
> Replace `YOUR_API_KEY` in the examples below with your actual API key.

## Claude Desktop

Claude Desktop supports OAuth authentication. Add to your config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tanstack": {
      "url": "https://tanstack.com/api/mcp"
    }
  }
}
```

Restart Claude Desktop. On first use, a browser window will open to authorize access.

<details>
<summary>Using an API key instead</summary>

```json
{
  "mcpServers": {
    "tanstack": {
      "command": "npx",
      "args": ["mcp-remote", "https://tanstack.com/api/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer YOUR_API_KEY"
      }
    }
  }
}
```

</details>

## Claude Code

```bash
claude mcp add --transport http tanstack https://tanstack.com/api/mcp
```

On first use, a browser window will open to authorize access.

<details>
<summary>Using an API key instead</summary>

```bash
claude mcp add --transport http tanstack https://tanstack.com/api/mcp --header "Authorization: Bearer YOUR_API_KEY"
```

</details>

## Cursor

Click to add the TanStack MCP server to Cursor:

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=tanstack&config=eyJjb21tYW5kIjoibnB4IG1jcC1yZW1vdGUgaHR0cHM6Ly90YW5zdGFjay5jb20vYXBpL21jcCJ9)

On first use, a browser window will open to authorize access.

<details>
<summary>Or add manually to your config</summary>

```json
{
  "mcpServers": {
    "tanstack": {
      "command": "npx",
      "args": ["mcp-remote", "https://tanstack.com/api/mcp"]
    }
  }
}
```

</details>

<details>
<summary>Using an API key instead</summary>

```json
{
  "mcpServers": {
    "tanstack": {
      "command": "npx",
      "args": ["mcp-remote", "https://tanstack.com/api/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization: Bearer YOUR_API_KEY"
      }
    }
  }
}
```

</details>

## VS Code

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "servers": {
    "tanstack": {
      "url": "https://tanstack.com/api/mcp"
    }
  }
}
```

<details>
<summary>Using an API key instead</summary>

```json
{
  "servers": {
    "tanstack": {
      "type": "http",
      "url": "https://tanstack.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

</details>

## OpenCode

Add to your OpenCode MCP configuration in `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "tanstack": {
      "type": "remote",
      "url": "https://tanstack.com/api/mcp",
      "enabled": true
    }
  }
}
```

After adding the config, run the auth flow manually the first time:

```bash
npx mcp-remote auth https://tanstack.com/api/mcp
```

This opens a browser to authorize access. After that, OpenCode will connect automatically.

<details>
<summary>Using an API key instead</summary>

```json
{
  "mcp": {
    "tanstack": {
      "type": "remote",
      "url": "https://tanstack.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      },
      "enabled": true
    }
  }
}
```

</details>

## Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "tanstack": {
      "serverUrl": "https://tanstack.com/api/mcp"
    }
  }
}
```

<details>
<summary>Using an API key instead</summary>

```json
{
  "mcpServers": {
    "tanstack": {
      "serverUrl": "https://tanstack.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

</details>

## MCP Inspector

Use the MCP Inspector to test the server interactively:

```bash
npx @modelcontextprotocol/inspector https://tanstack.com/api/mcp
```

<details>
<summary>Using an API key instead</summary>

```bash
npx @modelcontextprotocol/inspector https://tanstack.com/api/mcp --header "Authorization: Bearer YOUR_API_KEY"
```

</details>

## Custom Integration

For custom integrations, the server accepts standard MCP requests via HTTP:

- **Endpoint:** `https://tanstack.com/api/mcp`
- **Transport:** Streamable HTTP (stateless)
- **Methods:** POST (for requests), GET (for server-sent events), DELETE (for session cleanup)
- **Authentication:** OAuth 2.1 (recommended) or Bearer token via Authorization header

### OAuth 2.1 Flow

The server supports OAuth 2.1 with PKCE for secure authentication:

1. Discover endpoints via `/.well-known/oauth-authorization-server`
2. Redirect user to `/oauth/authorize` with PKCE challenge
3. Exchange authorization code at `/oauth/token`
4. Use the access token as a Bearer token

### API Key Authentication

Example request using curl with an API key:

```bash
curl -X POST https://tanstack.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

## Rate Limits

API requests are rate-limited to protect the service:

- **Authenticated requests:** 60 requests per minute
- Rate limit headers are included in responses (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)

## Verifying Connection

After connecting, ask your AI assistant to list TanStack libraries:

> "Use the TanStack MCP to list all available libraries"

You should see a list of all TanStack libraries with their versions and descriptions.
