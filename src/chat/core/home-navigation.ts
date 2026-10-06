export const homeSections = [
  'conversations',
  'attention',
  'packages',
  'skills',
  'routines',
  'workflows',
  'activity',
  'integrations',
  'servers',
  'memories',
  'mail',
  'usage',
  'community',
  'subscriptions',
  'webhooks',
  'secrets',
  'secret-providers',
  'shared',
  'account',
] as const
export type HomeSection = (typeof homeSections)[number]
export function isHomeSection(value: unknown): value is HomeSection {
  return (
    typeof value === 'string' &&
    homeSections.some((section) => section === value)
  )
}
