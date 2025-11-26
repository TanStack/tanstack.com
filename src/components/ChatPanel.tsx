import * as React from 'react'
import { useIsDark } from '~/hooks/useIsDark'
import type { ChatMessage } from '~/stores/aiLibraryHeroAnimation'

type ChatPanelProps = {
  messages: ChatMessage[]
}

export function ChatPanel({ messages }: ChatPanelProps) {
  const isDark = useIsDark()

  return (
    <div
      className={`flex flex-col w-full md:w-[400px] h-full rounded-lg border overflow-hidden ${
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex-1 overflow-hidden flex flex-col justify-end gap-3 p-4">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <React.Fragment key={message.id}>
              {/* User message - right aligned */}
              <div className="flex justify-end">
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg text-align-left ${
                    isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white text-align-right'
                  }`}
                >
                  <p className="text-base whitespace-pre-wrap text-left">
                    {message.user}
                  </p>
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
    </div>
  )
}
