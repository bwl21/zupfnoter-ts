/// <reference types="vite/client" />

declare global {
  // eslint-disable-next-line no-var
  var __ZUPFNOTER_BUILD_INFO__: {
    buildIdentifier: string
    buildTime: string
  } | undefined
}

export {}
