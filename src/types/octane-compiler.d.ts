declare module 'octane/compiler' {
  export type OctaneCompileOptions = {
    dev?: boolean
    hmr?: boolean | 'vite' | 'webpack'
    mode?: 'client' | 'server'
  }

  export type OctaneCompileResult = {
    code: string
    diagnostics: ReadonlyArray<unknown>
    map: unknown
  }

  export function compile(
    source: string,
    filename: string,
    options?: OctaneCompileOptions,
  ): OctaneCompileResult
}
