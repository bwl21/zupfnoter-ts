import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_WORKBENCH_CONFIG, type WorkbenchConfig } from './workbenchConfigDefaults'

export const useWorkbenchConfigStore = defineStore('workbenchConfig', () => {
  const config = ref<WorkbenchConfig>({ ...DEFAULT_WORKBENCH_CONFIG })

  const runtimeSettings = computed<Record<string, string>>(() => ({
    flowconf: config.value.flowconf ? 'true' : 'false',
    showInvisibles: config.value.showInvisibles ? 'true' : 'false',
  }))

  function setRuntimeSetting(key: string, value: string): void {
    if (key === 'flowconf') config.value.flowconf = value !== 'false'
    if (key === 'showInvisibles') config.value.showInvisibles = value !== 'false'
  }

  function getRuntimeSetting(key: string): string | undefined {
    return runtimeSettings.value[key]
  }

  return { config, runtimeSettings, setRuntimeSetting, getRuntimeSetting }
})
