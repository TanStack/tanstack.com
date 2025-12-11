import * as React from 'react'
import { useIsDark } from '~/hooks/useIsDark'
import type { ChatMessage } from '~/stores/aiLibraryHeroAnimation'

type ChatPanelProps = {
  messages: ChatMessage[]
  typingUserMessage: string
}

export function ChatPanel({ messages, typingUserMessage }: ChatPanelProps) {
  const isDark = useIsDark()

  return (
    <div
      className={`flex flex-col w-full md:w-[400px] h-full rounded-xl overflow-hidden shadow-2xl ${
        isDark
          ? 'bg-gradient-to-b from-gray-900/95 to-gray-950/95 border border-gray-800/50 backdrop-blur-sm'
          : 'bg-gradient-to-b from-white/95 to-gray-50/95 border border-gray-200/50 backdrop-blur-sm'
      }`}
    >
      {/* Header */}
      <div
        className={`px-5 py-3.5 border-b ${
          isDark
            ? 'bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-800/50'
            : 'bg-gradient-to-r from-white/50 to-gray-50/50 border-gray-200/50'
        }`}
      >
        <h3
          className={`text-[10px] font-semibold uppercase tracking-widest text-center ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
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
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl shadow-md ${
                    isDark
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                  }`}
                >
                  <p className="text-sm leading-relaxed text-left">
                    {message.user}
                  </p>
                </div>
              </div>
              {/* Assistant message - left aligned, appears below user message */}
              {message.assistant && (
                <div className="flex justify-start items-start">
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl shadow-md ${
                      isDark
                        ? 'bg-gray-800/60 text-gray-100 border border-gray-700/50 backdrop-blur-sm'
                        : 'bg-white/60 text-gray-900 border border-gray-200 backdrop-blur-sm'
                    }`}
                  >
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
      <div
        className={`border-t px-5 py-4 ${
          isDark
            ? 'bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-800/50'
            : 'bg-gradient-to-r from-white/50 to-gray-50/50 border-gray-200/50'
        }`}
      >
        <div
          className={`relative px-4 py-3 rounded-xl transition-all duration-200 ${
            isDark
              ? 'bg-gray-800/40 border border-gray-700/40'
              : 'bg-white/40 border border-gray-200/40'
          } ${
            typingUserMessage
              ? isDark
                ? 'ring-1 ring-blue-500/30 bg-gray-800/60'
                : 'ring-1 ring-blue-500/30 bg-white/60'
              : ''
          }`}
        >
          <p
            className={`text-sm min-h-[20px] text-left ${
              typingUserMessage
                ? isDark
                  ? 'text-gray-200'
                  : 'text-gray-900'
                : isDark
                  ? 'text-gray-600 italic'
                  : 'text-gray-400 italic'
            }`}
          >
            {typingUserMessage || 'Type a message...'}
          </p>
        </div>
      </div>
    </div>
  )
}
