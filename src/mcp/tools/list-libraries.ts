import { z } from 'zod'
import {
  libraries,
  librariesByGroup,
  librariesGroupNamesMap,
} from '~/libraries/libraries'

const groupKeys = ['state', 'headlessUI', 'performance', 'tooling'] as const
type GroupKey = (typeof groupKeys)[number]

export const listLibrariesSchema = z.object({
  group: z
    .enum(groupKeys)
    .optional()
    .describe(
      'Filter libraries by group. Options: state, headlessUI, performance, tooling',
    ),
})

export type ListLibrariesInput = z.infer<typeof listLibrariesSchema>

export async function listLibraries(input: ListLibrariesInput) {
  let librariesToReturn = libraries

  if (input.group) {
    const groupLibraries = librariesByGroup[input.group as GroupKey]
    if (groupLibraries) {
      librariesToReturn = groupLibraries
    }
  }

  // Filter out libraries without landing pages (react-charts, create-tsrouter-app)
  // and the MCP library itself (meta/circular)
  const filteredLibraries = librariesToReturn.filter(
    (lib) => lib.to && lib.id !== 'mcp',
  )

  const result = filteredLibraries.map((lib) => ({
    id: lib.id,
    name: lib.name,
    tagline: lib.tagline,
    description: lib.description,
    frameworks: lib.frameworks,
    latestVersion: lib.latestVersion,
    docsUrl: lib.defaultDocs
      ? `https://tanstack.com/${lib.id}/latest/docs/${lib.defaultDocs}`
      : `https://tanstack.com/${lib.id}`,
    githubUrl: lib.repo ? `https://github.com/${lib.repo}` : undefined,
  }))

  const groupName = input.group
    ? librariesGroupNamesMap[input.group as GroupKey]
    : 'All Libraries'

  return {
    group: groupName,
    count: result.length,
    libraries: result,
  }
}
