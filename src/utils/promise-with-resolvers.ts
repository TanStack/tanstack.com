declare global {
  interface PromiseConstructor {
    withResolvers?<T>(): {
      promise: Promise<T>
      reject: (reason?: unknown) => void
      resolve: (value: T | PromiseLike<T>) => void
    }
  }
}

if (typeof Promise.withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true,
    value: function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void

      const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve
        reject = nextReject
      })

      return {
        promise,
        reject,
        resolve,
      }
    },
    writable: true,
  })
}

export {}
