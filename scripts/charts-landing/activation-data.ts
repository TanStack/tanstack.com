const actual = [
  48, 50, 49, 53, 55, 54, 58, 61, 60, 64, 66, 65, 69, 72, 71, 74, 76, 78,
]

const expectedLow = [
  45, 46, 47, 48, 50, 51, 53, 54, 56, 58, 59, 61, 63, 65, 67, 69, 70, 72,
]

const expectedHigh = [
  52, 53, 54, 55, 57, 58, 60, 62, 63, 65, 67, 68, 70, 72, 74, 76, 78, 80,
]

export const weeks = actual.map((activation, index) => ({
  id: `activation:${index}`,
  date: new Date(Date.UTC(2026, 0, 5 + index * 7)),
  activation,
  expectedLow: expectedLow[index]!,
  expectedHigh: expectedHigh[index]!,
}))

export const releases = [
  {
    id: 'onboarding-v2',
    date: weeks[6]!.date,
    activation: weeks[6]!.activation,
    label: 'Onboarding v2',
  },
  {
    id: 'invite-flow',
    date: weeks[12]!.date,
    activation: weeks[12]!.activation,
    label: 'Invite flow',
  },
]
