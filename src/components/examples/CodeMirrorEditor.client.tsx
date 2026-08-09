import * as React from 'react'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { syntaxHighlighting } from '@codemirror/language'
import { Compartment } from '@codemirror/state'
import { classHighlighter } from '@lezer/highlight'
import { basicSetup, EditorView } from 'codemirror'

export function CodeMirrorEditor({
  onChange,
  onRun,
  path,
  theme,
  value,
}: {
  onChange: (value: string) => void
  onRun: () => void
  path: string
  theme: 'dark' | 'light'
  value: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const editorRef = React.useRef<EditorView>(null)
  const onChangeRef = React.useRef(onChange)
  const onRunRef = React.useRef(onRun)
  const themeCompartmentRef = React.useRef(new Compartment())
  const themeRef = React.useRef(theme)
  const valueRef = React.useRef(value)

  onChangeRef.current = onChange
  onRunRef.current = onRun
  themeRef.current = theme
  valueRef.current = value

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const editor = new EditorView({
      parent: container,
      doc: valueRef.current,
      extensions: [
        basicSetup,
        getLanguage(path),
        syntaxHighlighting(classHighlighter),
        EditorView.contentAttributes.of({
          'aria-label': `Edit ${path}`,
          spellcheck: 'false',
        }),
        EditorView.domEventHandlers({
          keydown(event) {
            if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) {
              return false
            }

            event.preventDefault()
            onRunRef.current()
            return true
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        themeCompartmentRef.current.of(createEditorTheme(themeRef.current)),
      ],
    })

    editorRef.current = editor
    return () => {
      editorRef.current = null
      editor.destroy()
    }
  }, [path])

  React.useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    editor.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        createEditorTheme(theme),
      ),
    })
  }, [theme])

  React.useEffect(() => {
    const editor = editorRef.current
    if (!editor || editor.state.doc.toString() === value) return

    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: value,
      },
    })
  }, [value])

  return <div ref={containerRef} className="h-full min-h-0" />
}

function createEditorTheme(theme: 'dark' | 'light') {
  return EditorView.theme(
    {
      '&': {
        backgroundColor: 'var(--th-background)',
        color: 'var(--th-token)',
        height: '100%',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'var(--color-background-subtle)',
      },
      '.cm-content': {
        caretColor: 'var(--color-text-primary)',
        fontFamily: 'var(--font-ds-mono)',
        fontSize: '13px',
        lineHeight: '1.6',
        minWidth: 'max-content',
        padding: '12px 0',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--color-text-primary)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--th-background)',
        borderRightColor: 'var(--color-border-default)',
        color: 'var(--color-text-muted)',
      },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--color-status-info-bg) !important',
      },
      '.tok-keyword': { color: 'var(--th-keyword)' },
      '.tok-atom, .tok-bool, .tok-literal': {
        color: 'var(--th-literal)',
      },
      '.tok-string, .tok-string2': { color: 'var(--th-string)' },
      '.tok-number': { color: 'var(--th-number)' },
      '.tok-variableName, .tok-variableName2': {
        color: 'var(--th-variable)',
      },
      '.tok-typeName, .tok-namespace, .tok-className': {
        color: 'var(--th-type)',
      },
      '.tok-propertyName': { color: 'var(--th-property)' },
      '.tok-operator': { color: 'var(--th-operator)' },
      '.tok-comment': { color: 'var(--th-comment)' },
      '.tok-meta': { color: 'var(--th-meta)' },
      '.tok-link': { color: 'var(--th-link)' },
      '.tok-heading': { color: 'var(--th-heading)' },
      '.tok-inserted': { color: 'var(--th-inserted)' },
      '.tok-deleted, .tok-invalid': { color: 'var(--th-deleted)' },
      '.tok-punctuation': { color: 'var(--th-token)' },
    },
    { dark: theme === 'dark' },
  )
}

function getLanguage(path: string) {
  if (/\.tsx?$/i.test(path)) {
    return javascript({ jsx: path.endsWith('x'), typescript: true })
  }
  if (/\.jsx?$/i.test(path)) return javascript({ jsx: path.endsWith('x') })
  if (/\.css$/i.test(path)) return css()
  if (/\.html?$/i.test(path)) return html()
  if (/\.json$/i.test(path)) return json()
  return []
}
