export interface BuildMetadata {
  appVersion: string
  commitHash: string
  buildIdentifier: string
  buildTime: string
}

export function readBuildMetadata(packageJsonPath: string, repositoryRoot: string): BuildMetadata
