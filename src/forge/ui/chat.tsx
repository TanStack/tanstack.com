import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Send, User } from 'lucide-react'

import type { DynamicToolUIPart, UIMessage } from 'ai'

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

  return (
    <div className="border rounded-lg bg-gray-900 mb-4">
      <button
        className="w-full flex justify-between items-center px-4 py-3 text-left font-bold text-blue-300 hover:bg-gray-800 focus:outline-none"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span>
          🛠️ Tool: <span className="font-mono">{part.type.split('-')[1]}</span>
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
}: {
  projectId: string
  initialMessages: Array<UIMessage>
  onSetCheckpoint: () => void
  projectDescription: string
}) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/forge/chat',
      body: {
        projectId,
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
  }, [messages, initialMessages, sendMessage])

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
              <div className="whitespace-pre-wrap break-words">
                {message.parts.map((part, index) => {
                  if (part.type === 'text') {
                    return <span key={index}>{part.text}</span>
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
              <Bot className="w-8 h-8 text-blue-400 bg-gray-800 rounded-full p-1.5" />
            </div>
            <div className="bg-gray-800 text-gray-100 border border-gray-700 max-w-xs lg:max-w-2xl px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-800 border-t border-gray-700 p-4">
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
              className="w-full bg-gray-700 text-gray-100 placeholder-gray-400 border border-gray-600 rounded-lg px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={
              status === 'submitted' || status === 'streaming' || !input.trim()
            }
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  )
}
