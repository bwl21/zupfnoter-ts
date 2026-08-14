import type { ConfigEditorOption } from './configSchema.js'
import type { Song } from '@zupfnoter/types'

export type ConfigEditorOptionSource = 'part'

export type ConfigEditorOptionProvider = (
  song: Song | undefined,
  configuredParts: Record<string, unknown> | undefined,
  currentValue: string,
) => readonly ConfigEditorOption[]

/** Erzeugt fachliche Auswahlwerte für einen dynamischen Konfigurationswert. */
export function resolveConfigEditorOptions(
  source: ConfigEditorOptionSource,
  song: Song | undefined,
  configuredParts: Record<string, unknown> | undefined,
  currentValue: string,
): readonly ConfigEditorOption[] {
  const provider = CONFIG_EDITOR_OPTION_PROVIDERS[source]
  return provider === undefined ? [] : provider(song, configuredParts, currentValue)
}

const CONFIG_EDITOR_OPTION_PROVIDERS: Record<ConfigEditorOptionSource, ConfigEditorOptionProvider> = {
  part: resolvePartOptions,
}

function resolvePartOptions(
  song: Song | undefined,
  configuredParts: Record<string, unknown> | undefined,
  currentValue: string,
): readonly ConfigEditorOption[] {

  const markerTimes = new Map<string, number>()
  for (const marker of song?.metaData.partSequence?.markers ?? []) {
    const text = marker.displayName.trim()
    if (text !== '' && !markerTimes.has(text)) markerTimes.set(text, marker.time)
  }
  for (const voice of song?.voices ?? []) {
    for (const entity of voice.entities) {
      if (entity.type !== 'NoteBoundAnnotation'
        || entity.confKey?.includes('notebound.partname') !== true) continue
      const text = entity.text.trim()
      if (text !== '' && !markerTimes.has(text)) markerTimes.set(text, entity.time)
    }
  }

  const keyByValue = new Map<string, string>()
  for (const [key, value] of Object.entries(configuredParts ?? {})) {
    if (typeof value === 'string' && value.trim() !== '') keyByValue.set(value.trim(), key)
  }

  return [...markerTimes.entries()]
    .sort(([left, leftTime], [right, rightTime]) => (
      Number(keyByValue.has(left)) - Number(keyByValue.has(right)) || leftTime - rightTime
    ))
    .map(([text]) => text)
    .filter((text) => !keyByValue.has(text) || text === currentValue)
    .map((text) => {
      const assignedKey = keyByValue.get(text)
      return {
        value: text,
        label: text,
        description: assignedKey === undefined
          ? 'Noch keinem Schlüssel zugeordnet'
          : `Schlüssel ${assignedKey}`,
      }
    })
}
