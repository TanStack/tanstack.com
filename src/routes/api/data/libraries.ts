import { createFileRoute } from '@tanstack/react-router'
import {
  libraries,
  librariesByGroup,
  librariesGroupNamesMap,
} from '~/libraries/libraries'

export const Route = createFileRoute('/api/data/libraries')({
  server: {
    handlers: {
      GET: async () => {
        const filteredLibraries = libraries
          .filter((lib) => lib.to && lib.id !== 'mcp')
          .map((lib) => ({
            id: lib.id,
            name: lib.name,
            tagline: lib.tagline,
            description: lib.description,
            frameworks: lib.frameworks,
            latestVersion: lib.latestVersion,
            latestBranch: lib.latestBranch,
            availableVersions: lib.availableVersions,
            repo: lib.repo,
            docsRoot: lib.docsRoot,
            defaultDocs: lib.defaultDocs,
            docsUrl: lib.defaultDocs
              ? `https://tanstack.com/${lib.id}/latest/docs/${lib.defaultDocs}`
              : `https://tanstack.com/${lib.id}`,
            githubUrl: lib.repo ? `https://github.com/${lib.repo}` : undefined,
          }))

        const groups = Object.fromEntries(
          Object.entries(librariesByGroup).map(([key, libs]) => [
            key,
            libs
              .filter((lib) => lib.to && lib.id !== 'mcp')
              .map((lib) => lib.id),
          ]),
        )

        return new Response(
          JSON.stringify({
            libraries: filteredLibraries,
            groups,
            groupNames: librariesGroupNamesMap,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
            },
          },
        )
      },
    },
  },
})
