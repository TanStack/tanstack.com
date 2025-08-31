import { memfs } from 'memfs'
import { dirname } from 'path'

// Patched list of binary extensions - SVG removed since it's text-based
const BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.ico']

function isBinaryFile(path: string): boolean {
  return BINARY_EXTENSIONS.some(ext => path.endsWith(ext))
}

function cleanUpFiles(
  files: Record<string, string>,
  returnPathsRelativeTo: string
) {
  const result: Record<string, string> = {}
  for (const [path, content] of Object.entries(files)) {
    const cleanPath = returnPathsRelativeTo 
      ? path.replace(returnPathsRelativeTo, '.') 
      : path
    result[cleanPath] = content
  }
  return result
}

function cleanUpFileArray(files: Array<string>, returnPathsRelativeTo: string) {
  return files.map(file => 
    returnPathsRelativeTo ? file.replace(returnPathsRelativeTo, '.') : file
  )
}

export function createMemoryEnvironment(returnPathsRelativeTo: string = '') {
  const { fs, vol } = memfs({})
  
  const output: {
    files: Record<string, string>
    deletedFiles: Array<string>
    commands: Array<{
      command: string
      args: Array<string>
    }>
  } = {
    files: {},
    commands: [],
    deletedFiles: [],
  }

  let errors: Array<string> = []

  const environment = {
    startRun: () => {
      errors = []
    },
    
    getErrors: () => errors,
    
    startStep: () => {},
    finishStep: () => {},
    
    intro: () => {},
    outro: () => {},
    info: () => {},
    error: () => {},
    warn: () => {},
    confirm: () => Promise.resolve(true),
    
    appName: 'TanStack',
    appendFile: async (path: string, contents: string) => {
      fs.mkdirSync(dirname(path), { recursive: true })
      await fs.appendFileSync(path, contents)
    },
    
    copyFile: async (from: string, to: string) => {
      fs.mkdirSync(dirname(to), { recursive: true })
      fs.copyFileSync(from, to)
      return Promise.resolve()
    },
    
    execute: async (command: string, args: Array<string>) => {
      output.commands.push({
        command,
        args,
      })
      return Promise.resolve({ stdout: '' })
    },
    
    readFile: async (path: string) => {
      return Promise.resolve(fs.readFileSync(path, 'utf-8').toString())
    },
    
    writeFile: async (path: string, contents: string) => {
      fs.mkdirSync(dirname(path), { recursive: true })
      await fs.writeFileSync(path, contents)
    },
    
    writeFileBase64: async (path: string, contents: string) => {
      fs.mkdirSync(dirname(path), { recursive: true })
      
      // Check if this is actually a binary file
      if (isBinaryFile(path)) {
        // For actual binary files, store the base64 content
        await fs.writeFileSync(path, contents)
      } else {
        // For text files (including SVG), decode from base64 if needed
        if (contents.startsWith('base64::')) {
          const decoded = Buffer.from(contents.replace('base64::', ''), 'base64').toString('utf-8')
          await fs.writeFileSync(path, decoded)
        } else {
          await fs.writeFileSync(path, contents)
        }
      }
    },
    
    deleteFile: async (path: string) => {
      output.deletedFiles.push(path)
      if (fs.existsSync(path)) {
        await fs.unlinkSync(path)
      }
    },
    
    finishRun: () => {
      const rawFiles = vol.toJSON() as Record<string, string>
      
      // Process files to handle base64 content properly
      for (const [file, content] of Object.entries(rawFiles)) {
        if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
          // Check if content looks like base64-encoded data for binary files
          if (isBinaryFile(file) && typeof content === 'string') {
            // Keep base64 for actual binary files
            if (content.startsWith('base64::')) {
              output.files[file] = content
            } else {
              // Add base64 prefix if it's binary but missing the prefix
              output.files[file] = `base64::${content}`
            }
          } else {
            // For text files (including SVG), ensure they're plain text
            if (content.startsWith('base64::')) {
              // Decode if it was mistakenly base64 encoded
              try {
                const decoded = Buffer.from(content.replace('base64::', ''), 'base64').toString('utf-8')
                output.files[file] = decoded
              } catch {
                output.files[file] = content
              }
            } else {
              output.files[file] = content
            }
          }
        }
      }
      
      if (returnPathsRelativeTo.length) {
        output.files = cleanUpFiles(output.files, returnPathsRelativeTo)
        output.deletedFiles = cleanUpFileArray(
          output.deletedFiles,
          returnPathsRelativeTo,
        )
      }
    },
    
    exists: (path: string) => {
      return fs.existsSync(path)
    },
    
    isDirectory: (path: string) => {
      return fs.existsSync(path) && fs.statSync(path).isDirectory()
    },
    
    readdir: async (path: string) => {
      return Promise.resolve(fs.readdirSync(path).map((d) => d.toString()))
    },
    
    rimraf: async () => {},
    
    installPackages: async () => {},
    
    spinner: () => ({
      start: () => {},
      stop: () => {},
    }),
  }

  return {
    environment,
    output,
  }
}