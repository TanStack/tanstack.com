---
id: tools
title: Available Tools
---

The TanStack MCP Server provides 5 tools for accessing documentation, NPM statistics, and ecosystem recommendations.

## list_libraries

List all available TanStack libraries with their metadata.

### Parameters

| Parameter | Type   | Required | Description                                                         |
| --------- | ------ | -------- | ------------------------------------------------------------------- |
| `group`   | string | No       | Filter by group: `state`, `headlessUI`, `performance`, or `tooling` |

### Response

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

## doc

Fetch a specific documentation page by library and path.

### Parameters

| Parameter | Type   | Required | Description                                                                             |
| --------- | ------ | -------- | --------------------------------------------------------------------------------------- |
| `library` | string | Yes      | Library ID (e.g., `query`, `router`, `table`, `form`)                                   |
| `path`    | string | Yes      | Documentation path (e.g., `framework/react/overview`, `framework/react/guides/queries`) |
| `version` | string | No       | Version (e.g., `v5`, `v1`). Defaults to `latest`                                        |

### Response

- `title` - Document title from frontmatter
- `content` - Full markdown content of the document
- `url` - Canonical URL to the documentation page
- `library` - Library name
- `version` - Resolved version

### Example

```json
{
  "name": "doc",
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

## npm_stats

NPM download statistics for TanStack org, individual libraries, or package comparisons.

### Parameters

| Parameter     | Type     | Required | Description                                                         |
| ------------- | -------- | -------- | ------------------------------------------------------------------- |
| `library`     | string   | No       | TanStack library ID (e.g., `query`, `router`)                       |
| `packages`    | string[] | No       | NPM packages to compare (max 10)                                    |
| `preset`      | string   | No       | Preset comparison ID (e.g., `data-fetching`)                        |
| `listPresets` | boolean  | No       | List available preset comparisons                                   |
| `range`       | string   | No       | Time range: `30d`, `90d`, `180d`, `1y`, `2y`, `all`. Default: `90d` |
| `bin`         | string   | No       | Aggregation: `monthly`, `weekly`, `daily`. Default: `monthly`       |

### Modes

The tool operates in different modes based on which parameters are provided:

1. **No parameters** - Returns TanStack org summary with library breakdown
2. **`library`** - Returns stats for a specific TanStack library with package details
3. **`packages`** - Compares arbitrary NPM packages
4. **`preset`** - Uses a preset comparison (e.g., `data-fetching`, `state-management`)
5. **`listPresets: true`** - Lists all available presets

### Response Examples

**Org summary (no params):**

```json
{
  "org": "tanstack",
  "totalDownloads": 1234567890,
  "ratePerDay": 5000000,
  "libraries": [{ "id": "query", "downloads": 500000000, "packages": 12 }]
}
```

**Package comparison:**

```json
{
  "range": { "start": "2024-01-01", "end": "2024-03-31" },
  "bin": "monthly",
  "packages": [
    {
      "name": "@tanstack/react-query",
      "total": 15000000,
      "avgPerDay": 165000,
      "data": [{ "date": "2024-01-01", "downloads": 5000000 }]
    }
  ]
}
```

### Examples

```json
// Org summary
{ "name": "npm_stats", "arguments": {} }

// Library breakdown
{ "name": "npm_stats", "arguments": { "library": "query" } }

// Compare packages
{
  "name": "npm_stats",
  "arguments": {
    "packages": ["@tanstack/react-query", "swr", "@apollo/client"],
    "range": "1y",
    "bin": "monthly"
  }
}

// Use preset
{ "name": "npm_stats", "arguments": { "preset": "data-fetching" } }

// List presets
{ "name": "npm_stats", "arguments": { "listPresets": true } }
```

### Available Presets

Use `listPresets: true` to see all available presets. Common ones include:

- `data-fetching` - React Query, SWR, Apollo, tRPC
- `state-management` - Redux, MobX, Zustand, Jotai, Valtio
- `routing-react` - React Router, TanStack Router, Next, Wouter
- `data-grids` - AG Grid, TanStack Table, Handsontable
- `virtualization` - TanStack Virtual, react-window, react-virtuoso
- `frameworks` - React, Vue, Angular, Svelte, Solid
- `forms` - React Hook Form, TanStack Form, Conform
- `validation` - Zod, Yup, Valibot, ArkType

---

## ecosystem

Ecosystem partner recommendations filtered by category or TanStack library.

### Parameters

| Parameter  | Type   | Required | Description                                                                                                              |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `category` | string | No       | Filter by category: `database`, `auth`, `deployment`, `monitoring`, `cms`, `api`, `data-grid`, `code-review`, `learning` |
| `library`  | string | No       | Filter by TanStack library (e.g., `start`, `router`, `query`)                                                            |

### Response

- `query` - The filters applied
- `count` - Number of partners returned
- `partners` - Array of partners with `id`, `name`, `tagline`, `description`, `category`, `categoryLabel`, `url`, `libraries`

### Example

```json
{
  "name": "ecosystem",
  "arguments": {
    "category": "database",
    "library": "start"
  }
}
```

---

## Usage Tips

### Finding Documentation

1. **Start with `list_libraries`** to discover available libraries and their IDs
2. **Use `search_docs`** to find specific topics when you don't know the exact path
3. **Use `doc`** to fetch the full content once you know the path

### Version Handling

- Use `latest` (default) to always get the current documentation
- Specify a version like `v5` or `v4` when working with a specific library version
- The `list_libraries` tool shows available versions for each library

### Path Discovery

Search results include URLs that reveal the documentation path structure. For example, a URL like `https://tanstack.com/query/latest/docs/framework/react/guides/queries` indicates:

- Library: `query`
- Path: `framework/react/guides/queries`

### Deep Source Code Exploration

For understanding library internals beyond what documentation provides (implementation details, type definitions, test patterns), clone the relevant repository directly:

| Library      | Clone Command                                             |
| ------------ | --------------------------------------------------------- |
| Query        | `git clone --depth 1 https://github.com/tanstack/query`   |
| Router/Start | `git clone --depth 1 https://github.com/tanstack/router`  |
| Table        | `git clone --depth 1 https://github.com/tanstack/table`   |
| Form         | `git clone --depth 1 https://github.com/tanstack/form`    |
| Virtual      | `git clone --depth 1 https://github.com/tanstack/virtual` |
| Store        | `git clone --depth 1 https://github.com/tanstack/store`   |
| DB           | `git clone --depth 1 https://github.com/tanstack/db`      |

Then use native file tools (grep, read) to explore implementations, types, and tests.

---

## Rate Limits

- **All operations**: 60 requests per minute
