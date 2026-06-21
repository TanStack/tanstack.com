import { Fragment, createElement } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { parseMarkdown } from './parser.js'
import type {
  BlockNode,
  ComponentNode,
  InlineNode,
  MarkdownInput,
  RenderOptions,
  TableCellNode,
} from './types.js'

type ComponentMap = Partial<Record<string, string | ComponentType<any>>>

export interface MarkdownReactOptions extends RenderOptions {
  components?: ComponentMap
}

export interface MarkdownProps extends MarkdownReactOptions {
  children: MarkdownInput
}

export function Markdown({
  children,
  ...options
}: MarkdownProps): ReactElement {
  return createElement(Fragment, null, renderMarkdownReact(children, options))
}

export function renderMarkdownReact(
  input: MarkdownInput,
  options: MarkdownReactOptions = {},
): ReactNode {
  const document =
    typeof input === 'string' ? parseMarkdown(input, options) : input
  return document.children.map((node, index) =>
    renderBlockReact(node, options, `b:${index}`),
  )
}

export function renderBlockReact(
  node: BlockNode,
  options: MarkdownReactOptions = {},
  key?: string,
): ReactElement {
  switch (node.type) {
    case 'heading':
      return h(
        options,
        `h${node.depth}`,
        {
          key,
          ...(node.id ? { id: node.id } : {}),
          ...(node.framework ? { 'data-framework': node.framework } : {}),
        },
        renderInlines(node.children, options),
        renderHeadingAnchorReact(node.id, options),
      )
    case 'paragraph':
      return h(options, 'p', { key }, renderInlines(node.children, options))
    case 'code':
      return renderCodeBlockReact(node, options, key)
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul'
      return h(
        options,
        tag,
        {
          key,
          ...(node.ordered && node.start && node.start !== 1
            ? { start: node.start }
            : {}),
        },
        node.items.map((item, index) =>
          h(
            options,
            'li',
            { key: index },
            item.checked === undefined
              ? null
              : h(options, 'input', {
                  type: 'checkbox',
                  disabled: true,
                  checked: item.checked,
                  readOnly: true,
                }),
            item.checked === undefined ? null : ' ',
            item.children.map((child, childIndex) =>
              renderBlockReact(child, options, `${index}:${childIndex}`),
            ),
          ),
        ),
      )
    }
    case 'blockquote':
      return h(
        options,
        'blockquote',
        { key },
        node.children.map((child, index) =>
          renderBlockReact(child, options, `${key}:${index}`),
        ),
      )
    case 'table':
      return h(
        options,
        'table',
        { key },
        h(
          options,
          'thead',
          null,
          h(
            options,
            'tr',
            null,
            node.header.map((cell, index) =>
              renderTableCellReact(
                'th',
                cell,
                node.align[index],
                options,
                index,
              ),
            ),
          ),
        ),
        h(
          options,
          'tbody',
          null,
          node.rows.map((row, rowIndex) =>
            h(
              options,
              'tr',
              { key: rowIndex },
              row.map((cell, index) =>
                renderTableCellReact(
                  'td',
                  cell,
                  node.align[index],
                  options,
                  index,
                ),
              ),
            ),
          ),
        ),
      )
    case 'thematicBreak':
      return h(options, 'hr', { key })
    case 'html':
      return options.allowHtml
        ? h(options, 'div', {
            key,
            dangerouslySetInnerHTML: { __html: node.value },
          })
        : h(options, 'p', { key }, node.value)
    case 'callout':
      return h(
        options,
        'div',
        {
          key,
          className: `markdown-alert markdown-alert-${node.kind.toLowerCase()}`,
        },
        h(options, 'p', { className: 'markdown-alert-title' }, node.title),
        h(
          options,
          'div',
          { className: 'markdown-alert-content' },
          node.children.map((child, index) =>
            renderBlockReact(child, options, `${key}:${index}`),
          ),
        ),
      )
    case 'component':
      return renderComponentReact(node, options, key)
  }
}

export function renderInlineReact(
  node: InlineNode,
  options: MarkdownReactOptions = {},
  key?: string,
): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value
    case 'inlineCode':
      return h(options, 'code', { key }, node.value)
    case 'strong':
      return h(
        options,
        'strong',
        { key },
        renderInlines(node.children, options),
      )
    case 'emphasis':
      return h(options, 'em', { key }, renderInlines(node.children, options))
    case 'strike':
      return h(options, 's', { key }, renderInlines(node.children, options))
    case 'link':
      return h(
        options,
        'a',
        { key, href: node.href, ...(node.title ? { title: node.title } : {}) },
        renderInlines(node.children, options),
      )
    case 'image':
      return h(options, 'img', {
        key,
        src: node.src,
        alt: node.alt,
        ...(node.title ? { title: node.title } : {}),
      })
    case 'break':
      return h(options, 'br', { key })
    case 'inlineElement':
      return renderInlineElementReact(node, options, key)
    case 'inlineHtml':
      return options.allowHtml
        ? h(options, 'span', {
            key,
            dangerouslySetInnerHTML: { __html: node.value },
          })
        : node.value
  }
}

function renderInlines(
  nodes: InlineNode[],
  options: MarkdownReactOptions,
): ReactNode[] {
  return nodes.map((node, index) =>
    renderInlineReact(node, options, `i:${index}`),
  )
}

function renderCodeBlockReact(
  node: Extract<BlockNode, { type: 'code' }>,
  options: MarkdownReactOptions,
  key?: string,
): ReactElement {
  const lang = node.lang ?? 'plaintext'
  const highlighter = options.highlighter

  const codeProps = {
    className: `language-${lang}`,
  }

  const content = highlighter ? undefined : node.value

  const highlighted = highlighter
    ? {
        dangerouslySetInnerHTML: {
          __html: highlighter(node.value, lang, {
            ...(node.highlightLines
              ? { highlightLines: node.highlightLines }
              : {}),
            ...(options.codeLineNumbers !== undefined
              ? { lineNumbers: options.codeLineNumbers }
              : {}),
          }),
        },
      }
    : undefined

  const pre = h(
    options,
    'pre',
    {
      className: 'tm-code',
      'data-lang': lang,
      ...(node.title ? { 'data-code-title': node.title } : {}),
      ...(node.file ? { 'data-filename': node.file } : {}),
      ...(node.framework ? { 'data-framework': node.framework } : {}),
    },
    h(options, 'code', { ...codeProps, ...highlighted }, content),
  )

  if (!node.title) return h(options, Fragment, { key }, pre)

  return h(
    options,
    'figure',
    { key, className: 'tm-code-frame', 'data-lang': lang },
    h(options, 'figcaption', null, node.title),
    pre,
  )
}

function renderTableCellReact(
  tag: 'td' | 'th',
  cell: TableCellNode,
  align: 'left' | 'center' | 'right' | undefined,
  options: MarkdownReactOptions,
  key: number,
): ReactElement {
  return h(
    options,
    tag,
    { key, ...(align ? { style: { textAlign: align } } : {}) },
    renderInlines(cell.children, options),
  )
}

function renderInlineElementReact(
  node: Extract<InlineNode, { type: 'inlineElement' }>,
  options: MarkdownReactOptions,
  key?: string,
): ReactElement {
  const props = {
    key,
    ...createReactAttributes(node.attributes),
  }

  if (node.void) return h(options, node.tagName, props)
  return h(options, node.tagName, props, renderInlines(node.children, options))
}

function createReactAttributes(
  attributes: Record<string, string>,
): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class') {
      props.className = value
      continue
    }

    if (key === 'style') {
      props.style = parseStyleAttribute(value)
      continue
    }

    props[key] = value || true
  }

  return props
}

function parseStyleAttribute(value: string): Record<string, string> {
  const style: Record<string, string> = {}

  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue

    const property = declaration.slice(0, colon).trim()
    const propertyValue = declaration.slice(colon + 1).trim()
    if (!property || !propertyValue) continue

    style[camelizeCssProperty(property)] = propertyValue
  }

  return style
}

function camelizeCssProperty(property: string) {
  if (property.startsWith('--')) return property
  return property.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  )
}

function h(
  options: MarkdownReactOptions,
  tag: string | typeof Fragment,
  props: Record<string, any> | null,
  ...children: ReactNode[]
): ReactElement {
  const component =
    typeof tag === 'string' ? (options.components?.[tag] ?? tag) : tag
  return createElement(component, props, ...children)
}

function renderComponentReact(
  node: ComponentNode,
  options: MarkdownReactOptions,
  key?: string,
): ReactElement {
  const tag = node.tagName ?? 'md-comment-component'
  const props: Record<string, string> = {
    ...(node.properties ?? {}),
  }

  if (!node.tagName) {
    props['data-component'] = node.name
    if (!props['data-attributes'])
      props['data-attributes'] = JSON.stringify(node.attributes)
  }

  return h(
    options,
    tag,
    { key, ...props },
    node.children.map((child, index) =>
      renderBlockReact(child, options, `${key}:${index}`),
    ),
  )
}

function renderHeadingAnchorReact(
  id: string | undefined,
  options: MarkdownReactOptions,
): ReactNode {
  if (!id || !options.headingAnchors) return null

  const anchorOptions =
    typeof options.headingAnchors === 'object' ? options.headingAnchors : {}
  return h(
    options,
    'a',
    {
      href: `#${id}`,
      'aria-hidden': anchorOptions.ariaHidden ?? true,
      className:
        anchorOptions.className ?? 'anchor-heading anchor-heading-link',
      tabIndex: anchorOptions.tabIndex ?? -1,
    },
    anchorOptions.content ?? '#',
  )
}
