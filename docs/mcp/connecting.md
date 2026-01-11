---
id: connecting
title: Connecting
---

The TanStack MCP Server is available at `https://tanstack.com/api/mcp` and uses the Streamable HTTP transport. Authentication via API key is required.

## Getting an API Key

Before connecting, you'll need to create an API key:

1. [Sign in to your TanStack account](/login)
2. Go to [API Keys](/account/api-keys)
3. Click "New Key" and give it a descriptive name
4. Copy the key immediately (you won't see it again)

> [!NOTE]
> Replace `YOUR_API_KEY` in the examples below with your actual API key.

## OpenCode

Add to your OpenCode MCP configuration in `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "servers": {
      "tanstack": {
        "type": "remote",
        "url": "https://tanstack.com/api/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_API_KEY"
        }
      }
    }
  }
}
```

## Claude Code

```bash
claude mcp add --transport http tanstack https://tanstack.com/api/mcp --header "Authorization: Bearer YOUR_API_KEY"
```

## Cursor

Add to your Cursor MCP configuration:

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

## VS Code

Add to your VS Code settings or `.vscode/mcp.json`:

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

## Claude Desktop

Add the following to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop after updating the configuration.

## Windsurf

Add to your Windsurf MCP configuration:

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

## MCP Inspector

Use the MCP Inspector to test the server interactively:

```bash
npx @modelcontextprotocol/inspector https://tanstack.com/api/mcp --header "Authorization: Bearer YOUR_API_KEY"
```

## Custom Integration

For custom integrations, the server accepts standard MCP requests via HTTP:

- **Endpoint:** `https://tanstack.com/api/mcp`
- **Transport:** Streamable HTTP (stateless)
- **Methods:** POST (for requests), GET (for server-sent events), DELETE (for session cleanup)
- **Authentication:** Bearer token via Authorization header

Example request using curl:

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
