import * as React from 'react'
import type { ChatMessage } from '~/stores/aiLibraryHeroAnimation'

type ChatPanelProps = {
  messages: ChatMessage[]
  typingUserMessage: string
}

export function ChatPanel({ messages, typingUserMessage }: ChatPanelProps) {
  return (
    <div className="flex flex-col w-full md:w-[400px] h-full rounded-xl overflow-hidden shadow-lg bg-gradient-to-b from-white/95 to-gray-50/95 dark:from-gray-900/95 dark:to-gray-950/95 border border-gray-200/50 dark:border-gray-800/50 backdrop-blur-sm">
      {/* Header */}
      <div className="px-5 py-3.5 border-b bg-gradient-to-r from-white/50 to-gray-50/50 dark:from-gray-900/50 dark:to-gray-800/50 border-gray-200/50 dark:border-gray-800/50">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-center text-gray-400 dark:text-gray-500">
          Chat Panel
        </h3>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end gap-3.5 p-5">
        <div className="flex flex-col gap-3.5">
          {messages.map((message) => (
            <React.Fragment key={message.id}>
              {/* User message - right aligned */}
              <div className="flex justify-end">
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl shadow-md bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white">
                  <p className="text-sm leading-relaxed text-left">
                    {message.user}
                  </p>
                </div>
              </div>
              {/* Assistant message - left aligned, appears below user message */}
              {message.assistant && (
                <div className="flex justify-start items-start">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl shadow-md bg-white/60 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50 backdrop-blur-sm">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-left">
                      {message.assistant}
                      {message.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-1.5 bg-blue-500 animate-pulse rounded-sm" />
                      )}
                    </p>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Input field at bottom */}
      <div className="border-t px-5 py-4 bg-gradient-to-r from-white/50 to-gray-50/50 dark:from-gray-900/50 dark:to-gray-800/50 border-gray-200/50 dark:border-gray-800/50">
        <div
          className={`relative px-4 py-3 rounded-xl transition-all duration-200 bg-white/40 dark:bg-gray-800/40 border border-gray-200/40 dark:border-gray-700/40 ${
            typingUserMessage
              ? 'ring-1 ring-blue-500/30 !bg-white/60 dark:!bg-gray-800/60'
              : ''
          }`}
        >
          <p
            className={`text-sm min-h-[20px] text-left ${
              typingUserMessage
                ? 'text-gray-900 dark:text-gray-200'
                : 'text-gray-400 dark:text-gray-600 italic'
            }`}
          >
            {typingUserMessage || 'Type a message...'}
          </p>
        </div>
      </div>
    </div>
  )
}
