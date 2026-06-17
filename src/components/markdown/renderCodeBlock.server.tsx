import { transformerNotationDiff } from '@shikijs/transformers'
import type { HighlighterGeneric } from 'shiki'
import { createHighlighter } from 'shiki'
import type { RenderedCodeBlockData } from './codeBlock.shared'

const LANG_ALIASES: Record<string, string> = {
  cmd: 'bash',
  console: 'bash',
  eslintrc: 'jsonc',
  js: 'javascript',
  json5: 'jsonc',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  text: 'plaintext',
  ts: 'typescript',
  txt: 'plaintext',
  yml: 'yaml',
  zsh: 'bash',
}

let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null
const failedLanguages = new Set<string>()

async function getHighlighter(language: string) {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'aurora-x'],
      langs: ['plaintext'],
    })
  }

  const highlighter = await highlighterPromise
  const normalizedLang = LANG_ALIASES[language] || language
  const langToLoad = normalizedLang === 'mermaid' ? 'plaintext' : normalizedLang

  if (failedLanguages.has(langToLoad)) {
    return {
      effectiveLang: 'plaintext',
      highlighter,
    }
  }

  if (!highlighter.getLoadedLanguages().includes(langToLoad as any)) {
    try {
      await highlighter.loadLanguage(langToLoad as any)
    } catch {
      failedLanguages.add(langToLoad)

      return {
        effectiveLang: 'plaintext',
        highlighter,
      }
    }
  }

  return {
    effectiveLang: langToLoad,
    highlighter,
  }
}

export async function renderCodeBlockData({
  code,
  lang,
  title,
}: {
  code: string
  lang: string
  title?: string
}): Promise<RenderedCodeBlockData> {
  const trimmedCode = code.trimEnd()
  const { effectiveLang, highlighter } = await getHighlighter(lang)
  const htmlMarkup = ['github-light', 'aurora-x']
    .map((theme) => {
      return highlighter.codeToHtml(trimmedCode, {
        lang: effectiveLang,
        theme,
        transformers: [transformerNotationDiff()],
      })
    })
    .join('')

  return {
    copyText: trimmedCode,
    htmlMarkup,
    lang,
    title,
  }
}
