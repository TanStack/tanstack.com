import { parseMarkdown } from './parser.js'
import type {
  BlockNode,
  ComponentNode,
  InlineNode,
  MarkdownDocument,
  MarkdownInput,
  RenderOptions,
  TableCellNode,
} from './types.js'
import { escapeAttr, escapeHtml } from './utils.js'

export function renderHtml(
  input: MarkdownInput,
  options: RenderOptions = {},
): string {
  const document =
    typeof input === 'string' ? parseMarkdown(input, options) : input
  return document.children.map((node) => renderBlock(node, options)).join('\n')
}

export function renderBlock(
  node: BlockNode,
  options: RenderOptions = {},
): string {
  const extension = renderExtension(node, options)
  if (extension !== undefined) return extension

  switch (node.type) {
    case 'heading': {
      const id = node.id ? ` id="${escapeAttr(node.id)}"` : ''
      const framework = node.framework
        ? ` data-framework="${escapeAttr(node.framework)}"`
        : ''
      return `<h${node.depth}${id}${framework}>${renderInlines(node.children, options)}${renderHeadingAnchor(node.id, options)}</h${node.depth}>`
    }
    case 'paragraph':
      return `<p>${renderInlines(node.children, options)}</p>`
    case 'code':
      return renderCodeBlock(node, options)
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul'
      const start =
        node.ordered && node.start && node.start !== 1
          ? ` start="${node.start}"`
          : ''
      const items = node.items
        .map((item) => {
          const task =
            item.checked === undefined
              ? ''
              : `<input type="checkbox" disabled${item.checked ? ' checked' : ''}> `
          return `<li>${task}${item.children.map((child) => renderBlock(child, options)).join('\n')}</li>`
        })
        .join('\n')
      return `<${tag}${start}>\n${items}\n</${tag}>`
    }
    case 'blockquote':
      return `<blockquote>\n${node.children.map((child) => renderBlock(child, options)).join('\n')}\n</blockquote>`
    case 'table': {
      const header = `<thead><tr>${node.header.map((cell, index) => renderTableCell('th', cell, node.align[index], options)).join('')}</tr></thead>`
      const body = `<tbody>${node.rows
        .map(
          (row) =>
            `<tr>${row.map((cell, index) => renderTableCell('td', cell, node.align[index], options)).join('')}</tr>`,
        )
        .join('')}</tbody>`
      return `<table>${header}${body}</table>`
    }
    case 'thematicBreak':
      return '<hr>'
    case 'html':
      return options.allowHtml ? node.value : escapeHtml(node.value)
    case 'callout':
      return renderCallout(node, options)
    case 'component':
      return renderComponent(node, options)
  }
}

export function renderInline(
  node: InlineNode,
  options: RenderOptions = {},
): string {
  const extension = renderExtension(node, options)
  if (extension !== undefined) return extension

  switch (node.type) {
    case 'text':
      return escapeHtml(node.value)
    case 'inlineCode':
      return `<code>${escapeHtml(node.value)}</code>`
    case 'strong':
      return `<strong>${renderInlines(node.children, options)}</strong>`
    case 'emphasis':
      return `<em>${renderInlines(node.children, options)}</em>`
    case 'strike':
      return `<s>${renderInlines(node.children, options)}</s>`
    case 'link':
      return `<a href="${escapeAttr(node.href)}"${node.title ? ` title="${escapeAttr(node.title)}"` : ''}>${renderInlines(node.children, options)}</a>`
    case 'image':
      return `<img src="${escapeAttr(node.src)}" alt="${escapeAttr(node.alt)}"${node.title ? ` title="${escapeAttr(node.title)}"` : ''}>`
    case 'break':
      return '<br>'
    case 'inlineElement':
      return renderInlineElement(node, options)
    case 'inlineHtml':
      return options.allowHtml ? node.value : escapeHtml(node.value)
  }
}

export function renderDocument(
  document: MarkdownDocument,
  options: RenderOptions = {},
): string {
  return renderHtml(document, options)
}

function renderInlines(nodes: InlineNode[], options: RenderOptions): string {
  return nodes.map((node) => renderInline(node, options)).join('')
}

function renderCodeBlock(
  node: Extract<BlockNode, { type: 'code' }>,
  options: RenderOptions,
): string {
  const lang = node.lang ?? 'plaintext'
  const codeAttrs = ` class="language-${escapeAttr(lang)}"`
  const preAttrs = [
    'class="tm-code"',
    `data-lang="${escapeAttr(lang)}"`,
    node.title ? `data-code-title="${escapeAttr(node.title)}"` : '',
    node.file ? `data-filename="${escapeAttr(node.file)}"` : '',
    node.framework ? `data-framework="${escapeAttr(node.framework)}"` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const highlighter = options.highlighter
  const highlightOptions = {
    ...(node.highlightLines ? { highlightLines: node.highlightLines } : {}),
    ...(options.codeLineNumbers !== undefined
      ? { lineNumbers: options.codeLineNumbers }
      : {}),
  }
  const html = highlighter
    ? highlighter(node.value, lang, highlightOptions)
    : escapeHtml(node.value)

  const pre = `<pre ${preAttrs}><code${codeAttrs}>${html}</code></pre>`
  if (!node.title) return pre

  return `<figure class="tm-code-frame" data-lang="${escapeAttr(lang)}"><figcaption>${escapeHtml(node.title)}</figcaption>${pre}</figure>`
}

function renderCallout(
  node: Extract<BlockNode, { type: 'callout' }>,
  options: RenderOptions,
): string {
  const kind = node.kind.toLowerCase()
  const children = node.children
    .map((child) => renderBlock(child, options))
    .join('\n')
  return `<div class="markdown-alert markdown-alert-${escapeAttr(kind)}"><p class="markdown-alert-title">${escapeHtml(node.title)}</p><div class="markdown-alert-content">${children}</div></div>`
}

function renderComponent(node: ComponentNode, options: RenderOptions): string {
  const tag = node.tagName ?? 'md-comment-component'
  const attrs = renderComponentAttrs(node)
  const children = node.children
    .map((child) => renderBlock(child, options))
    .join('\n')
  return `<${tag}${attrs}>${children}</${tag}>`
}

function renderTableCell(
  tag: 'td' | 'th',
  cell: TableCellNode,
  align: 'left' | 'center' | 'right' | undefined,
  options: RenderOptions,
): string {
  const style = align ? ` style="text-align:${align}"` : ''
  return `<${tag}${style}>${renderInlines(cell.children, options)}</${tag}>`
}

function renderInlineElement(
  node: Extract<InlineNode, { type: 'inlineElement' }>,
  options: RenderOptions,
): string {
  const attrs = renderAttributes(node.attributes)
  if (node.void) return `<${node.tagName}${attrs}>`
  return `<${node.tagName}${attrs}>${renderInlines(node.children, options)}</${node.tagName}>`
}

function renderAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes)
  if (!entries.length) return ''
  return ` ${entries
    .map(([key, value]) =>
      value ? `${key}="${escapeAttr(value)}"` : escapeAttr(key),
    )
    .join(' ')}`
}

function renderExtension(
  node: BlockNode | InlineNode,
  options: RenderOptions,
): string | undefined {
  for (const extension of options.extensions ?? []) {
    const rendered = extension.renderHtml?.(node, {
      options,
      renderBlock: (block) => renderBlock(block, options),
      renderInline: (inline) => renderInline(inline, options),
    })
    if (rendered !== undefined) return rendered
  }
  return undefined
}

function renderHeadingAnchor(
  id: string | undefined,
  options: RenderOptions,
): string {
  if (!id || !options.headingAnchors) return ''

  const anchorOptions =
    typeof options.headingAnchors === 'object' ? options.headingAnchors : {}
  const content = anchorOptions.content ?? '#'
  const className =
    anchorOptions.className ?? 'anchor-heading anchor-heading-link'
  const ariaHidden = anchorOptions.ariaHidden ?? true
  const tabIndex = anchorOptions.tabIndex ?? -1

  return `<a href="#${escapeAttr(id)}" aria-hidden="${ariaHidden}" class="${escapeAttr(className)}" tabindex="${tabIndex}">${escapeHtml(content)}</a>`
}

function renderComponentAttrs(node: ComponentNode): string {
  const props: Record<string, string> = {
    ...node.properties,
  }

  if (!node.tagName) {
    props['data-component'] = node.name
    if (!props['data-attributes'])
      props['data-attributes'] = JSON.stringify(node.attributes)
  }

  const entries = Object.entries(props)
  if (!entries.length) return ''
  return ` ${entries.map(([key, value]) => `${key}="${escapeAttr(value)}"`).join(' ')}`
}
