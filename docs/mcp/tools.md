---
id: tools
title: Available Tools
---

The TanStack MCP Server exposes tools for accessing documentation and managing showcase submissions.

## Documentation Tools

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

---

## Showcase Tools

These tools allow you to interact with the TanStack showcase, a gallery of projects built with TanStack libraries.

### search_showcases

Search approved showcase projects. No authentication required.

#### Parameters

| Parameter       | Type     | Required | Description                                                  |
| --------------- | -------- | -------- | ------------------------------------------------------------ |
| `query`         | string   | No       | Text search across name, tagline, description, and URL       |
| `libraryIds`    | string[] | No       | Filter by TanStack library IDs (e.g., `["query", "router"]`) |
| `useCases`      | string[] | No       | Filter by use cases (e.g., `["saas", "dashboard"]`)          |
| `hasSourceCode` | boolean  | No       | Filter to only open source projects                          |
| `featured`      | boolean  | No       | Filter to only featured projects                             |
| `limit`         | number   | No       | Max results (default: 20, max: 100)                          |
| `offset`        | number   | No       | Pagination offset (default: 0)                               |

#### Valid Library IDs

`query`, `router`, `start`, `table`, `form`, `virtual`, `ranger`, `store`, `pacer`, `db`, `ai`, `config`, `devtools`

#### Valid Use Cases

`blog`, `e-commerce`, `saas`, `dashboard`, `documentation`, `portfolio`, `social`, `developer-tool`, `marketing`, `media`

#### Example

```json
{
  "name": "search_showcases",
  "arguments": {
    "libraryIds": ["query", "router"],
    "useCases": ["saas"],
    "limit": 10
  }
}
```

---

### get_showcase

Get details of a specific showcase project by ID.

#### Parameters

| Parameter | Type   | Required | Description   |
| --------- | ------ | -------- | ------------- |
| `id`      | string | Yes      | Showcase UUID |

#### Example

```json
{
  "name": "get_showcase",
  "arguments": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### submit_showcase

Submit a new project to the TanStack showcase. **Requires authentication.** Submissions are reviewed by moderators before appearing publicly.

#### Parameters

| Parameter       | Type     | Required | Description                            |
| --------------- | -------- | -------- | -------------------------------------- |
| `name`          | string   | Yes      | Project name (max 255 characters)      |
| `tagline`       | string   | Yes      | Short description (max 500 characters) |
| `description`   | string   | No       | Full description                       |
| `url`           | string   | Yes      | Project URL                            |
| `screenshotUrl` | string   | Yes      | Screenshot URL                         |
| `sourceUrl`     | string   | No       | Source code URL (GitHub, etc.)         |
| `logoUrl`       | string   | No       | Logo URL                               |
| `libraries`     | string[] | Yes      | TanStack library IDs used              |
| `useCases`      | string[] | Yes      | Use case categories                    |

#### Example

```json
{
  "name": "submit_showcase",
  "arguments": {
    "name": "My Awesome App",
    "tagline": "A dashboard built with TanStack Query and Router",
    "url": "https://myapp.com",
    "screenshotUrl": "https://myapp.com/screenshot.png",
    "sourceUrl": "https://github.com/user/myapp",
    "libraries": ["query", "router"],
    "useCases": ["dashboard", "saas"]
  }
}
```

---

### update_showcase

Update an existing showcase submission. **Requires authentication and ownership.** Updates reset the showcase to pending review.

#### Parameters

| Parameter       | Type     | Required | Description                      |
| --------------- | -------- | -------- | -------------------------------- |
| `id`            | string   | Yes      | Showcase UUID to update          |
| `name`          | string   | Yes      | Project name                     |
| `tagline`       | string   | Yes      | Short description                |
| `description`   | string   | No       | Full description                 |
| `url`           | string   | Yes      | Project URL                      |
| `screenshotUrl` | string   | Yes      | Screenshot URL                   |
| `sourceUrl`     | string   | No       | Source code URL (null to remove) |
| `logoUrl`       | string   | No       | Logo URL (null to remove)        |
| `libraries`     | string[] | Yes      | TanStack library IDs             |
| `useCases`      | string[] | Yes      | Use case categories              |

#### Example

```json
{
  "name": "update_showcase",
  "arguments": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Updated App",
    "tagline": "Now with TanStack Form!",
    "url": "https://myapp.com",
    "screenshotUrl": "https://myapp.com/new-screenshot.png",
    "libraries": ["query", "router", "form"],
    "useCases": ["dashboard", "saas"]
  }
}
```

---

### delete_showcase

Delete a showcase submission. **Requires authentication and ownership.**

#### Parameters

| Parameter | Type   | Required | Description             |
| --------- | ------ | -------- | ----------------------- |
| `id`      | string | Yes      | Showcase UUID to delete |

#### Example

```json
{
  "name": "delete_showcase",
  "arguments": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### list_my_showcases

List your own showcase submissions. **Requires authentication.** Returns all your submissions including pending and denied ones.

#### Parameters

| Parameter | Type   | Required | Description                                       |
| --------- | ------ | -------- | ------------------------------------------------- |
| `status`  | string | No       | Filter by status: `pending`, `approved`, `denied` |
| `limit`   | number | No       | Max results (default: 20, max: 100)               |
| `offset`  | number | No       | Pagination offset (default: 0)                    |

#### Example

```json
{
  "name": "list_my_showcases",
  "arguments": {
    "status": "pending",
    "limit": 10
  }
}
```

---

## Rate Limits

- **Read operations** (documentation, search): 60 requests per minute
- **Write operations** (submit, update, delete): 10 requests per hour
- **Pending submission limit**: Maximum 5 pending submissions per user
