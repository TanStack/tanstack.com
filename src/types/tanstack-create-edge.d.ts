declare module '@tanstack/create/dist/edge-add-ons.js' {
  export function loadRemoteAddOn(
    url: string,
  ): Promise<import('@tanstack/create/edge').AddOn>
}
