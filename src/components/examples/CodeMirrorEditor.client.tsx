import * as React from 'react'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { basicSetup, EditorView } from 'codemirror'

export function CodeMirrorEditor({
  onChange,
  onRun,
  path,
  value,
}: {
  onChange: (value: string) => void
  onRun: () => void
  path: string
  value: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const editorRef = React.useRef<EditorView>(null)
  const onChangeRef = React.useRef(onChange)
  const onRunRef = React.useRef(onRun)
  const valueRef = React.useRef(value)

  onChangeRef.current = onChange
  onRunRef.current = onRun
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
        EditorView.theme(
          {
            '&': {
              backgroundColor: '#030712',
              color: '#f3f4f6',
              height: '100%',
            },
            '&.cm-focused': { outline: 'none' },
            '.cm-activeLine': { backgroundColor: '#111827' },
            '.cm-activeLineGutter': { backgroundColor: '#111827' },
            '.cm-content': {
              caretColor: '#f9fafb',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              padding: '12px 0',
            },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#f9fafb' },
            '.cm-gutters': {
              backgroundColor: '#030712',
              borderRightColor: '#1f2937',
              color: '#6b7280',
            },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-selectionBackground, ::selection': {
              backgroundColor: '#064e3b !important',
            },
          },
          { dark: true },
        ),
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
