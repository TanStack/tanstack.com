export function usePlatform() {
  if (typeof navigator === "undefined") {
    return;
  }
  return navigator.platform;
}