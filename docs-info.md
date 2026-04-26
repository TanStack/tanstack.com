# Maintainer Documentation Guide

This page covers the markdown features supported in TanStack docs and the preferred workflow for future redirects.

## Redirects

For new page moves or consolidations, keep the canonical page and list old URLs in frontmatter with `redirect_from`.

```yaml
---
title: Overview
redirect_from:
  - /framework/react/overview
  - /framework/solid/overview
---
```

In the example above, old framework-specific URLs will redirect to the shared `/overview` page without needing to add a new entry to the central redirect files in the `tanstack.com` repo.

## Supported markdown

Docs support normal GitHub-flavored markdown, including:

- headings
- links
- lists
- tables
- fenced code blocks
- images
- blockquotes
- task lists

## Callouts

GitHub-style alerts are supported. For a customized title, for example to replace `Note` with something else, you can use the syntax `> [!TYPE] Title`:

```md
> [!NOTE] Custom title
> Use `redirect_from` on the canonical page when docs are moved.

> [!TIP]
> Prefer absolute paths like `/framework/react/overview`.
```

## Code Blocks

Fenced code blocks are supported with language identifiers for syntax highlighting. You can also add metadata like `title="..."` for file tabs.

````md
```tsx title="app.tsx"
export function App() {
  return <div>Hello</div>
}
```
````

## Tabs component

The tabs component lets you group content into tabbed sections. It supports multiple variants, including file tabs and package manager tabs.

### File tabs

Use `variant="files"` when the block should render code examples as file tabs. It scans consecutive code blocks, extracts language, title, and content, and uses that to build `file-tab` data. Titles come from code-block metadata such as `title="..."` or will default to the language name if not provided.

````md
<!-- ::start:tabs variant="files" -->

```tsx file="app.tsx"
export function App() {
  return <div>Hello</div>
}
```

```css file="styles.css"
body {
  color: tomato;
}
```

<!-- ::end:tabs -->
````

### What matters

- use fenced code blocks
- add `title="..."` if you want meaningful file tab labels
- language comes from the code fence language
- code text is extracted from the `<code>` node content

### Package manager tabs

Package-manager tabs are a special `tabs` variant. The parser reads framework lines like `react: ...` or `solid: ...`, groups packages, and later generates package-manager-specific commands.

There are various supported package manager formats, including npm, yarn, pnpm, and bun.

If you're looking to support a multi-line command, you can add multiple instances of the same framework. For example:

```md
<!-- ::start:tabs variant="package-manager" -->

react: <package-1>
react: <package-2>

<!-- ::end:tabs -->
```

This will become:

```bash
npm i <package-1>
npm i <package-2>
```

#### Supported modes

- `install` (default)
- `dev-install`
- `local-install`
- `create`
- `custom` (for custom command templates)

##### Install (default)

```md
<!-- ::start:tabs variant="package-manager" mode="install" -->

react: <package>
solid: <package>

<!-- ::end:tabs -->
```

becomes

```bash
npm i <package>
```

##### Dev install

```md
<!-- ::start:tabs variant="package-manager" mode="dev-install" -->

react: <package>
solid: <package>

<!-- ::end:tabs -->
```

becomes

```bash
npm i -D <package>
```

##### Local install

```md
<!-- ::start:tabs variant="package-manager" mode="local-install" -->

react: <package>
solid: <package>

<!-- ::end:tabs -->
```

becomes

```bash
npx <package> --workspace=./path/to/workspace
```

##### Create

```md
<!-- ::start:tabs variant="package-manager" mode="create" -->

react: <package>
solid: <package>

<!-- ::end:tabs -->
```

becomes

```bash
npm create <package>
```

##### Custom

```md
<!-- ::start:tabs variant="package-manager" mode="custom" -->

react: <command> <package>
solid: <command> <package>

<!-- ::end:tabs -->
```

becomes

```bash
npm <command> <package>
```

## Framework component

Framework blocks let one markdown source contain React, Solid, or other framework-specific content. Internally, the transformer looks for h1 headings inside the framework block and treats each `# Heading` as a framework section boundary. It then stores framework metadata and rewrites the block into separate framework panels.

> **Note**: This should only be used when the majority of the content is the same. If the content is mostly different, it's better to create separate markdown files for each framework and use redirects to point to the canonical page.

````md
<!-- ::start:framework -->

# React

Use the React adapter here.

```tsx
// React code
```

# Solid

Use the Solid adapter here.

```tsx
// Solid Code
```

<!-- ::end:framework -->
````

Each top-level `#` heading becomes a framework panel. Nested headings inside a framework section are preserved for the table of contents.

## Editing notes

- Keep redirects on the surviving page, not on the page being removed.
- Use absolute paths in `redirect_from`.
- Avoid duplicate `redirect_from` values across pages.
- Existing central redirect files still handle older redirects; use frontmatter for new ones going forward.
