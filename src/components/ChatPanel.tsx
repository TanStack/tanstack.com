import * as React from 'react'
import { useIsDark } from '~/hooks/useIsDark'

type ChatPanelProps = {
  userMessage: string | null
  assistantMessage: string | null
  isStreaming: boolean
  opacity?: number
}

export function ChatPanel({
  userMessage,
  assistantMessage,
  isStreaming,
  opacity = 1.0,
}: ChatPanelProps) {
  const isDark = useIsDark()

  return (
    <div
      className={`flex flex-col gap-4 w-full md:w-[400px] h-[400px] p-4 rounded-lg border transition-opacity duration-500 ${
        isDark
          ? 'bg-gray-900/50 border-gray-700'
          : 'bg-white/50 border-gray-200'
      }`}
      style={{ opacity }}
    >
      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {userMessage && (
          <div className="flex justify-end">
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              }`}
            >
              <p className="text-base">{userMessage}</p>
            </div>
          </div>
        )}
        {assistantMessage && (
          <div className="flex justify-start items-start">
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg text-left ${
                isDark
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-base whitespace-pre-wrap text-left">
                {assistantMessage}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
