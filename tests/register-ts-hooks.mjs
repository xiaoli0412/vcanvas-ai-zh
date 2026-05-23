import { registerHooks } from 'node:module'

const EXTENSION_RE = /\.[cm]?[jt]sx?$/

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        error.code === 'ERR_MODULE_NOT_FOUND' &&
        (specifier.startsWith('./') || specifier.startsWith('../')) &&
        !EXTENSION_RE.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context)
      }

      throw error
    }
  },
})
