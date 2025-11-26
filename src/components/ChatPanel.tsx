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
      className={`flex flex-col w-full md:w-[400px] h-full rounded-lg border overflow-hidden ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <h3
          className={`text-sm font-semibold ${
            isDark ? 'text-gray-200' : 'text-gray-900'
          }`}
        >
          Chat Panel
        </h3>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end gap-3 p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <React.Fragment key={message.id}>
              {/* User message - right aligned */}
              <div className="flex justify-end">
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                  }`}
                >
                  <p className="text-base">{message.user}</p>
                </div>
              </div>
              {/* Assistant message - left aligned, appears below user message */}
              {message.assistant && (
                <div className="flex justify-start items-start">
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg text-left ${
                      isDark
                        ? 'bg-gray-700 text-gray-100'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-base whitespace-pre-wrap text-left">
                      {message.assistant}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
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
        className={`border-t px-4 py-3 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <input
          type="text"
          readOnly
          value={typingUserMessage}
          placeholder=""
          className={`w-full px-4 py-2 rounded-lg border ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>
    </div>
  )
}
