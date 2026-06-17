interface ZupfnoterBuildInfo {
  appVersion: string
  commitHash: string
  buildTime: string
}

declare global {
  // eslint-disable-next-line no-var
  var __ZUPFNOTER_BUILD_INFO__: ZupfnoterBuildInfo | undefined
}

export {}
