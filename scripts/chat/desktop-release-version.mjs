export function assertNewerRelease(next, current) {
  const parts = (value) => {
    if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value))
      throw Error('Invalid release version')
    return value.split('.').map(Number)
  }
  const nextVersion = parts(next)
  if (current === null) return
  const currentVersion = parts(current)
  const difference = nextVersion.findIndex(
    (value, index) => value !== currentVersion[index],
  )
  if (difference < 0 || nextVersion[difference] < currentVersion[difference])
    throw Error('Release version must increase')
}
