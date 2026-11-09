import type { parseVisitorLocation } from '../utils/visitor-location'

export const initialView = {
  phi: -Math.PI / 2 - 0.25,
  theta: 0.4,
  scale: 1.2,
}

export function initialMaintainersView(
  location: ReturnType<typeof parseVisitorLocation>,
) {
  return location
    ? {
        ...initialView,
        phi: (-location.longitude * Math.PI) / 180 - Math.PI / 2,
        theta: (location.latitude * Math.PI) / 180,
      }
    : { ...initialView }
}
