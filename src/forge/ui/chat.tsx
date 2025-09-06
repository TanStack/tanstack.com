import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { githubDarkInit } from '@uiw/codemirror-theme-github'
import {
  Bot,
  Send,
  User,
  Folder,
  File,
  Trash2,
  FileText,
  Edit,
  Copy,
  Check,
} from 'lucide-react'

import type { DynamicToolUIPart, UIMessage } from 'ai'

// CodeMirror theme configuration
const codeMirrorTheme = githubDarkInit({
  settings: {
    background: 'rgb(3, 7, 18)', // bg-gray-950
    foreground: '#c9d1d9',
    gutterBackground: 'rgb(31, 41, 55)', // bg-gray-800
    gutterForeground: '#6b7280',
    selection: '#264f78',
    selectionMatch: '#264f78',
  },
})

// Language detection for CodeMirror
function getCodeMirrorLanguage(language: string) {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      return javascript({ jsx: false })
    case 'jsx':
      return javascript({ jsx: true })
    case 'typescript':
    case 'ts':
      return javascript({ typescript: true, jsx: false })
    case 'tsx':
      return javascript({ typescript: true, jsx: true })
    case 'json':
      return json()
    case 'css':
      return css()
    case 'html':
      return html()
    default:
      return javascript() // Default fallback
  }
}

function CodeBlock({ children, className, ...props }: any) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match?.[1] || 'text'
  const codeContent = String(children).replace(/\n$/, '')

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(codeContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group mb-4">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg border-b border-gray-700">
        <span className="text-sm text-gray-400 font-mono">{language}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-1 text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
          type="button"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span className="text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="rounded-b-lg overflow-hidden">
        <CodeMirror
          value={codeContent}
          theme={codeMirrorTheme}
          extensions={[getCodeMirrorLanguage(language)]}
          editable={false}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: false,
            bracketMatching: true,
            closeBrackets: false,
            autocompletion: false,
            highlightSelectionMatches: false,
            searchKeymap: false,
          }}
          style={{
            fontSize: '14px',
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          }}
        />
      </div>
    </div>
  )
}

// Enhanced markdown processing to handle GFM-like features manually
function preprocessMarkdown(content: string): string {
  // Handle strikethrough text (~~text~~)
  content = content.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Handle task lists (- [ ] and - [x])
  content = content.replace(
    /^(\s*)- \[ \] (.+)$/gm,
    '$1- <input type="checkbox" disabled class="mr-2" /> $2'
  )
  content = content.replace(
    /^(\s*)- \[x\] (.+)$/gm,
    '$1- <input type="checkbox" disabled checked class="mr-2" /> $2'
  )

  // Handle tables (basic support)
  content = content.replace(/\|(.+)\|/g, (match, tableContent) => {
    const cells = tableContent.split('|').map((cell: string) => cell.trim())
    return `<div class="table-row">${cells
      .map((cell: string) => `<span class="table-cell">${cell}</span>`)
      .join('')}</div>`
  })

  return content
}

function MarkdownMessage({ content }: { content: string }) {
  const processedContent = preprocessMarkdown(content)

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight as any]}
      className="prose prose-invert prose-sm max-w-none"
      components={{
        code({ node, className, children, ...props }) {
          const hasLang = /language-(\w+)/.exec(className || '')
          return hasLang?.[1] ? (
            <CodeBlock className={className} {...props}>
              {children}
            </CodeBlock>
          ) : (
            <code
              className="bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre({ children }) {
          return <>{children}</>
        },
        p({ children }) {
          return <p className="mb-4 last:mb-0">{children}</p>
        },
        ul({ children }) {
          return (
            <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
          )
        },
        ol({ children }) {
          return (
            <ol className="list-decimal list-inside mb-4 space-y-1">
              {children}
            </ol>
          )
        },
        li({ children }) {
          return <li className="ml-0">{children}</li>
        },
        h1({ children }) {
          return <h1 className="text-xl font-bold mb-4">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-lg font-bold mb-3">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-base font-bold mb-2">{children}</h3>
        },
        h4({ children }) {
          return <h4 className="text-sm font-bold mb-2">{children}</h4>
        },
        h5({ children }) {
          return <h5 className="text-xs font-bold mb-1">{children}</h5>
        },
        h6({ children }) {
          return <h6 className="text-xs font-bold mb-1">{children}</h6>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-300 mb-4">
              {children}
            </blockquote>
          )
        },
        a({ children, href }) {
          return (
            <a
              href={href}
              className="text-blue-400 hover:text-blue-300 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          )
        },
        del({ children }) {
          return <del className="line-through text-gray-400">{children}</del>
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-gray-600 rounded-lg">
                {children}
              </table>
            </div>
          )
        },
        thead({ children }) {
          return <thead className="bg-gray-800">{children}</thead>
        },
        tbody({ children }) {
          return <tbody className="bg-gray-900">{children}</tbody>
        },
        tr({ children }) {
          return <tr className="border-b border-gray-600">{children}</tr>
        },
        th({ children }) {
          return (
            <th className="px-4 py-2 text-left font-semibold text-gray-200 border-r border-gray-600 last:border-r-0">
              {children}
            </th>
          )
        },
        td({ children }) {
          return (
            <td className="px-4 py-2 text-gray-300 border-r border-gray-600 last:border-r-0">
              {children}
            </td>
          )
        },
        input({ type, checked, disabled, className }) {
          if (type === 'checkbox') {
            return (
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                className="mr-2 accent-blue-500"
                readOnly
              />
            )
          }
          return null
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  )
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded mb-2 bg-gray-800">
      <button
        className="w-full flex justify-between items-center px-3 py-2 text-left font-semibold hover:bg-gray-700 focus:outline-none"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span>{title}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-4 py-2">{children}</div>}
    </div>
  )
}

function ToolInvocation({ part }: { part: DynamicToolUIPart }) {
  const [open, setOpen] = useState(false)
  const toolName = part.type?.split('-')?.[1] || part.type || 'unknown'

  // Get tool-specific icon and display info
  const getToolIcon = (name: string) => {
    switch (name) {
      case 'listDirectory':
        return <Folder className="w-4 h-4 text-blue-400" />
      case 'readFile':
        return <FileText className="w-4 h-4 text-green-400" />
      case 'writeFile':
        return <Edit className="w-4 h-4 text-orange-400" />
      case 'deleteFile':
        return <Trash2 className="w-4 h-4 text-red-400" />
      default:
        return <File className="w-4 h-4 text-gray-400" />
    }
  }

  const getToolColor = (name: string) => {
    switch (name) {
      case 'listDirectory':
        return 'text-blue-300'
      case 'readFile':
        return 'text-green-300'
      case 'writeFile':
        return 'text-orange-300'
      case 'deleteFile':
        return 'text-red-300'
      default:
        return 'text-gray-300'
    }
  }

  // For simple tools (listDirectory, readFile, deleteFile), show a compact display
  const isSimpleTool = ['listDirectory', 'readFile', 'deleteFile'].includes(
    toolName
  )

  if (isSimpleTool) {
    const path = (part.input as any)?.path || 'unknown path'
    return (
      <div className="relative">
        <div className="flex items-center space-x-3 py-2 px-3 bg-gray-800 rounded-lg mb-2 border border-gray-700">
          {getToolIcon(toolName)}
          <span className={`text-sm ${getToolColor(toolName)} font-medium`}>
            {toolName}
          </span>
          <span className="text-gray-400 text-sm font-mono flex-1">{path}</span>
          <button
            className="text-gray-500 hover:text-gray-300 text-xs"
            onClick={() => setOpen((o) => !o)}
            type="button"
          >
            {open ? 'Hide' : 'Details'}
          </button>
        </div>
        {open && (
          <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 mb-2">
            <CollapsibleSection title="Output" defaultOpen={true}>
              <pre className="bg-gray-950 rounded p-2 text-xs overflow-x-auto">
                {typeof part.output === 'object'
                  ? JSON.stringify(part.output, null, 2)
                  : String(part.output)}
              </pre>
            </CollapsibleSection>
          </div>
        )}
      </div>
    )
  }

  // For writeFile, show streaming content with CodeMirror
  if (toolName === 'writeFile') {
    const path = (part.input as any)?.path || 'unknown path'
    const content = (part.input as any)?.content || ''

    // Detect language from file extension
    const getLanguageFromPath = (filePath: string): string => {
      const extension = filePath.split('.').pop()?.toLowerCase() || ''
      switch (extension) {
        case 'js':
          return 'javascript'
        case 'jsx':
          return 'jsx'
        case 'ts':
          return 'typescript'
        case 'tsx':
          return 'tsx'
        case 'json':
          return 'json'
        case 'css':
          return 'css'
        case 'html':
          return 'html'
        default:
          return 'javascript'
      }
    }

    return (
      <div className="border rounded-lg bg-gray-900 mb-4">
        <div className="flex items-center space-x-3 px-4 py-3 border-b border-gray-700">
          {getToolIcon(toolName)}
          <span className={`font-medium ${getToolColor(toolName)}`}>
            Writing file
          </span>
          <span className="text-gray-400 text-sm font-mono flex-1">{path}</span>
        </div>
        <div className="p-0 overflow-hidden">
          <CodeMirror
            value={content}
            theme={codeMirrorTheme}
            extensions={[getCodeMirrorLanguage(getLanguageFromPath(path))]}
            editable={false}
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: false,
              bracketMatching: true,
              closeBrackets: false,
              autocompletion: false,
              highlightSelectionMatches: false,
              searchKeymap: false,
            }}
            style={{
              fontSize: '14px',
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              maxHeight: '400px',
            }}
          />
        </div>
      </div>
    )
  }

  // Default tool display for other tools
  return (
    <div className="border rounded-lg bg-gray-900 mb-4">
      <button
        className="w-full flex justify-between items-center px-4 py-3 text-left font-bold text-blue-300 hover:bg-gray-800 focus:outline-none"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="flex items-center space-x-2">
          {getToolIcon(toolName)}
          <span>
            Tool: <span className="font-mono">{toolName}</span>
          </span>
        </span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-2 pb-3">
          <CollapsibleSection title="Input" defaultOpen={true}>
            <pre className="bg-gray-950 rounded p-2 text-xs overflow-x-auto">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          </CollapsibleSection>
          <CollapsibleSection title="Output" defaultOpen={true}>
            <pre className="bg-gray-950 rounded p-2 text-xs overflow-x-auto">
              {typeof part.output === 'object'
                ? JSON.stringify(part.output, null, 2)
                : String(part.output)}
            </pre>
          </CollapsibleSection>
        </div>
      )}
    </div>
  )
}

export default function Chat({
  projectId,
  initialMessages,
  onSetCheckpoint,
  projectDescription,
  llmKeys,
}: {
  projectId: string
  initialMessages: Array<UIMessage>
  onSetCheckpoint: () => void
  projectDescription: string
  llmKeys: Array<{
    provider: string
    keyName: string
    isActive: boolean
    apiKey: string
  }>
}) {
  // Get available models based on active keys
  const activeKeys = llmKeys.filter((key) => key.isActive)
  const hasOpenAI = activeKeys.some((key) => key.provider === 'openai')
  const hasAnthropic = activeKeys.some((key) => key.provider === 'anthropic')

  // Build available models list
  const availableModels = []
  if (hasAnthropic) {
    availableModels.push({
      value: 'claude-3-5-sonnet-latest',
      label: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
    })
  }
  if (hasOpenAI) {
    availableModels.push(
      { value: 'gpt-4', label: 'GPT-4', provider: 'openai' },
      { value: 'gpt-4-mini', label: 'GPT-4 Mini', provider: 'openai' }
    )
  }

  // Default to Sonnet if available, otherwise first available model
  const defaultModel = hasAnthropic
    ? 'claude-3-5-sonnet-latest'
    : availableModels[0]?.value ?? ''
  const [selectedModel, setSelectedModel] = useState(defaultModel)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/forge/chat',
      body: {
        projectId,
        model: selectedModel,
        llmKeys,
      },
    }),
    messages: initialMessages,
  })
  const [input, setInput] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sentBootMessage = useRef(false)
  useEffect(() => {
    if (
      messages.length === 0 &&
      initialMessages.length === 0 &&
      !sentBootMessage.current
    ) {
      sentBootMessage.current = true
      sendMessage({
        text: projectDescription,
      })
    }
  }, [messages, initialMessages, sendMessage, projectDescription])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Let's customize your app!</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0">
                <Bot className="w-8 h-8 text-blue-400 bg-gray-800 rounded-full p-1.5" />
              </div>
            )}

            <div
              className={`max-w-xs lg:max-w-2xl px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100 border border-gray-700'
              }`}
            >
              <div className="break-words">
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return message.role === 'user' ? (
                      <span key={index} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    ) : (
                      <MarkdownMessage key={index} content={part.text} />
                    )
                  }
                  if (part.type.startsWith('tool-')) {
                    return (
                      <ToolInvocation
                        key={index}
                        part={part as DynamicToolUIPart}
                      />
                    )
                  }
                  return null
                })}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0">
                <User className="w-8 h-8 text-green-400 bg-gray-800 rounded-full p-1.5" />
              </div>
            )}
          </div>
        ))}

        {(status === 'submitted' || status === 'streaming') && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Bot className="w-8 h-8 text-blue-400 bg-gray-800 rounded-full p-1.5 animate-pulse" />
            </div>
            <div className="bg-gray-800 text-gray-100 border border-gray-700 max-w-xs lg:max-w-2xl px-4 py-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
                <span className="text-sm text-gray-400 ml-2">
                  {status === 'streaming' ? 'Responding...' : 'Thinking...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-800 border-t border-gray-700 p-4 space-y-3">
        {/* Model Selector */}
        <div className="flex items-center space-x-3">
          <label
            htmlFor="model-select"
            className="text-sm font-medium text-gray-300"
          >
            Model:
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chat Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage({ text: input })
            setInput('')
            onSetCheckpoint()
          }}
          className="flex space-x-3"
        >
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-gray-700 text-gray-100 placeholder-gray-400 border border-gray-600 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (
                    input.trim() &&
                    status !== 'submitted' &&
                    status !== 'streaming'
                  ) {
                    sendMessage({ text: input })
                    setInput('')
                    onSetCheckpoint()
                  }
                }
              }}
              disabled={status === 'submitted' || status === 'streaming'}
            />
          </div>
          <button
            type="submit"
            disabled={
              status === 'submitted' || status === 'streaming' || !input.trim()
            }
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2 font-medium"
          >
            <Send
              className={`w-4 h-4 ${
                status === 'submitted' || status === 'streaming'
                  ? 'animate-pulse'
                  : ''
              }`}
            />
            <span>
              {status === 'submitted' || status === 'streaming'
                ? 'Sending...'
                : 'Send'}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
