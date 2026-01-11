---
id: tools
title: Available Tools
---

The TanStack MCP Server exposes three tools for accessing documentation. Each tool is designed for a specific use case.

## list_libraries

List all available TanStack libraries with their metadata.

### Parameters

| Parameter | Type   | Required | Description                                                         |
| --------- | ------ | -------- | ------------------------------------------------------------------- |
| `group`   | string | No       | Filter by group: `state`, `headlessUI`, `performance`, or `tooling` |

### Response

Returns an object containing:

- `group` - The group name or "All Libraries"
- `count` - Number of libraries returned
- `libraries` - Array of library objects with `id`, `name`, `tagline`, `description`, `frameworks`, `latestVersion`, `docsUrl`, and `githubUrl`

### Example

```json
{
  "name": "list_libraries",
  "arguments": {
    "group": "state"
  }
}
```

---

## get_doc

Fetch a specific documentation page by library and path.

### Parameters

| Parameter | Type   | Required | Description                                                                             |
| --------- | ------ | -------- | --------------------------------------------------------------------------------------- |
| `library` | string | Yes      | Library ID (e.g., `query`, `router`, `table`, `form`)                                   |
| `path`    | string | Yes      | Documentation path (e.g., `framework/react/overview`, `framework/react/guides/queries`) |
| `version` | string | No       | Version (e.g., `v5`, `v1`). Defaults to `latest`                                        |

### Response

Returns an object containing:

- `title` - Document title from frontmatter
- `content` - Full markdown content of the document
- `url` - Canonical URL to the documentation page
- `library` - Library name
- `version` - Resolved version

### Example

```json
{
  "name": "get_doc",
  "arguments": {
    "library": "query",
    "path": "framework/react/guides/queries",
    "version": "v5"
  }
}
```

### Common Documentation Paths

Most TanStack libraries follow this path structure:

- `framework/{framework}/overview` - Framework-specific overview
- `framework/{framework}/installation` - Installation guide
- `framework/{framework}/guides/{topic}` - Guides for specific topics
- `framework/{framework}/reference/{api}` - API reference

Where `{framework}` is one of: `react`, `vue`, `solid`, `svelte`, `angular`

---

## search_docs

Full-text search across all TanStack documentation.

### Parameters

| Parameter   | Type   | Required | Description                                                  |
| ----------- | ------ | -------- | ------------------------------------------------------------ |
| `query`     | string | Yes      | Search query                                                 |
| `library`   | string | No       | Filter to specific library (e.g., `query`, `router`)         |
| `framework` | string | No       | Filter to specific framework (e.g., `react`, `vue`, `solid`) |
| `limit`     | number | No       | Maximum results (default: 10, max: 50)                       |

### Response

Returns an object containing:

- `query` - The search query
- `totalHits` - Total number of matching documents
- `results` - Array of search results with `title`, `url`, `snippet`, `library`, and `breadcrumb`

### Example

```json
{
  "name": "search_docs",
  "arguments": {
    "query": "useQuery refetch",
    "library": "query",
    "framework": "react",
    "limit": 5
  }
}
```

---

## Usage Tips

### Finding Documentation

1. **Start with `list_libraries`** to discover available libraries and their IDs
2. **Use `search_docs`** to find specific topics when you don't know the exact path
3. **Use `get_doc`** to fetch the full content once you know the path

### Version Handling

- Use `latest` (default) to always get the current documentation
- Specify a version like `v5` or `v4` when working with a specific library version
- The `list_libraries` tool shows available versions for each library

### Path Discovery

Search results include URLs that reveal the documentation path structure. For example, a URL like `https://tanstack.com/query/latest/docs/framework/react/guides/queries` indicates:

- Library: `query`
- Path: `framework/react/guides/queries`
