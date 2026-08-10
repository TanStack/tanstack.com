declare module 'octane/compiler' {
  export type OctaneCompileOptions = {
    dev?: boolean
    hmr?: boolean | 'vite' | 'webpack'
    mode?: 'client' | 'server'
  }

  export type OctaneCompilePosition = {
    offset: number
    line: number
    column: number
  }

  export type OctaneCompileDiagnostic = {
    code: string
    severity: string
    message: string
    filename: string
    start: OctaneCompilePosition
    end: OctaneCompilePosition
  }

  export type OctaneCompileResult = {
    code: string
    diagnostics: ReadonlyArray<OctaneCompileDiagnostic>
    map: unknown
  }

  export function compile(
    source: string,
    filename: string,
    options?: OctaneCompileOptions,
  ): OctaneCompileResult
}
