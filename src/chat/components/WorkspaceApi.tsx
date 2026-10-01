import { createContext, useContext, useMemo, type ReactNode } from 'react'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export function workspaceApi(workspaceId?: string) {
  const url = (path: string) => {
    const target = new URL('/api/chat/' + path, 'https://tanstack.com')
    if (workspaceId) target.searchParams.set('workspaceId', workspaceId)
    return target.pathname + target.search + target.hash
  }
  return {
    workspaceId,
    url,
    request: async <T,>(
      path: string,
      body?: unknown,
      method = body === undefined ? 'GET' : 'POST',
      options?: { signal?: AbortSignal },
    ): Promise<T> => {
      const response = await fetch(url(path), {
        signal: options?.signal,
        method,
        headers:
          body === undefined
            ? undefined
            : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = (await response.json()) as T & { error?: string }
      if (!response.ok)
        throw new ApiError(data.error ?? 'Request failed.', response.status)
      return data
    },
  }
}

const WorkspaceApiContext = createContext(workspaceApi())
export function WorkspaceApiProvider({
  workspaceId,
  children,
}: {
  workspaceId?: string
  children: ReactNode
}) {
  const value = useMemo(() => workspaceApi(workspaceId), [workspaceId])
  return (
    <WorkspaceApiContext.Provider value={value}>
      {children}
    </WorkspaceApiContext.Provider>
  )
}
export const useWorkspaceApi = () => useContext(WorkspaceApiContext)
