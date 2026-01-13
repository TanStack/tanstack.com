---
id: overview
title: Overview
---

TanStack MCP Server provides AI assistants with direct access to TanStack documentation through the [Model Context Protocol](https://modelcontextprotocol.io). This allows AI tools like Claude, Cursor, and others to search and retrieve up-to-date documentation for all TanStack libraries.

## Why Use the MCP Server?

AI assistants are trained on snapshots of documentation that become stale over time. The TanStack MCP Server solves this by giving AI tools real-time access to:

- **Current documentation** for all TanStack libraries (Router, Query, Table, Form, Virtual, Store, and more)
- **Version-specific docs** for the exact version you're using
- **Full-text search** across all documentation

## Quick Start

Most MCP clients support OAuth authentication. Just add the server URL:

```
https://tanstack.com/api/mcp
```

Your client will open a browser window to authorize access on first use. No API key needed.

See [Connecting](./connecting) for client-specific setup instructions.

## Available Tools

The MCP server exposes tools for documentation and showcase management:

### Documentation Tools

| Tool             | Description                                                  | Auth Required |
| ---------------- | ------------------------------------------------------------ | ------------- |
| `list_libraries` | List all TanStack libraries with their versions and metadata | No            |
| `get_doc`        | Fetch a specific documentation page by library and path      | No            |
| `search_docs`    | Full-text search across all TanStack documentation           | No            |

### Showcase Tools

| Tool                | Description                                | Auth Required |
| ------------------- | ------------------------------------------ | ------------- |
| `search_showcases`  | Search approved TanStack showcase projects | No            |
| `get_showcase`      | Get details of a specific showcase project | No            |
| `submit_showcase`   | Submit a new project to the showcase       | Yes           |
| `update_showcase`   | Update your existing showcase submission   | Yes           |
| `delete_showcase`   | Delete your showcase submission            | Yes           |
| `list_my_showcases` | List your own showcase submissions         | Yes           |

### NPM Stats Tools

| Tool                        | Description                                             | Auth Required |
| --------------------------- | ------------------------------------------------------- | ------------- |
| `get_npm_stats`             | Get aggregated download stats for TanStack or a library | No            |
| `list_npm_comparisons`      | List preset package comparisons (Data Fetching, etc.)   | No            |
| `compare_npm_packages`      | Compare download stats for multiple packages over time  | No            |
| `get_npm_package_downloads` | Get detailed historical downloads for a single package  | No            |

See [Available Tools](./tools) for detailed parameter documentation.

## How It Works

The TanStack MCP Server uses the Streamable HTTP transport, making it compatible with serverless deployments and any MCP client that supports HTTP transport. When your AI assistant needs TanStack documentation, it calls the appropriate tool and receives the content directly.

```
AI Assistant → MCP Client → TanStack MCP Server → Documentation
```

All documentation is fetched directly from the TanStack GitHub repositories, ensuring you always get the most current content for your specified version.
