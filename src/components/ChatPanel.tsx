import * as React from 'react'
import { useIsDark } from '~/hooks/useIsDark'

type ChatPanelProps = {
  userMessage: string | null
  assistantMessage: string | null
  isStreaming: boolean
}

export function ChatPanel({
  userMessage,
  assistantMessage,
  isStreaming,
}: ChatPanelProps) {
  const isDark = useIsDark()

  return (
    <div
      className={`flex flex-col gap-4 w-full max-w-md h-[400px] p-4 rounded-lg border ${
        isDark
          ? 'bg-gray-900/50 border-gray-700'
          : 'bg-white/50 border-gray-200'
      }`}
    >
      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {userMessage && (
          <div className="flex justify-end">
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              }`}
            >
              <p className="text-sm">{userMessage}</p>
            </div>
          </div>
        )}
        {assistantMessage && (
          <div className="flex justify-start">
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                isDark
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">
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
