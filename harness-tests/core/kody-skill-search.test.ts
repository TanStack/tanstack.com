import { describe, expect, it } from 'vitest'
import {
  kodySkillMatches,
  kodySkillQuery,
  searchKodySkillMatches,
} from '../../src/chat/server/kody-skill-search'

describe('Kody skill search projection', () => {
  it('keeps only matched skill documents from Kody retrievers', () => {
    const result = kodySkillMatches({
      structuredContent: {
        result: {
          matches: [
            {
              type: 'retriever_result',
              id: 'test-audit',
              title: 'test-audit',
              summary: 'Review tests for value and coverage.',
              source: 'skills registry',
              packageId: '4b0f2b31-224c-4d8b-8e5d-28dc10456316',
              kodyId: 'skills',
              retrieverKey: 'skills',
            },
            {
              type: 'retriever_result',
              id: 'unrelated',
              title: 'unrelated',
              summary: 'Not a skill.',
              source: 'other',
              packageId: '4b0f2b31-224c-4d8b-8e5d-28dc10456316',
              kodyId: 'other',
              retrieverKey: 'other',
            },
          ],
          memories: {
            retrieverResults: [
              {
                id: 'test-audit',
                packageId: '4b0f2b31-224c-4d8b-8e5d-28dc10456316',
                metadata: { skill_id: 'test-audit' },
              },
            ],
          },
        },
      },
    })
    expect(result).toEqual([
      {
        id: 'test-audit',
        name: 'test-audit',
        description: 'Review tests for value and coverage.',
        source: 'kody',
        packageId: '4b0f2b31-224c-4d8b-8e5d-28dc10456316',
        packageEntity: 'package:skills',
        retrieverKey: 'skills',
      },
    ])
    expect(kodySkillQuery('test audit skill')).toBe('test audit')
  })

  it('tries the specific skill query if the broad term did not match', async () => {
    const queries: string[] = []
    const result = await searchKodySkillMatches('test skill', async (query) => {
      queries.push(query)
      return {
        structuredContent: {
          result: {
            matches:
              query === 'test skill'
                ? [
                    {
                      type: 'retriever_result',
                      id: 'test-audit',
                      title: 'test-audit',
                      summary: 'Review tests.',
                      source: 'skills registry',
                      packageId: '4b0f2b31-224c-4d8b-8e5d-28dc10456316',
                      kodyId: 'skills',
                      retrieverKey: 'skills',
                    },
                  ]
                : [],
            memories: {
              retrieverResults:
                query === 'test skill'
                  ? [
                      {
                        id: 'test-audit',
                        packageId: '4b0f2b31-224c-4d8b-8e5d-28dc10456316',
                        metadata: { skill_id: 'test-audit' },
                      },
                    ]
                  : [],
            },
          },
        },
      }
    })
    expect(queries).toEqual(['test', 'test skill'])
    expect(result.map((item) => item.id)).toEqual(['test-audit'])
  })
})
