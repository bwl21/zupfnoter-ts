<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import ZnPanel from '../../design-system/components/ZnPanel.vue'
import ZnPanelHeader from '../../design-system/components/ZnPanelHeader.vue'
import type { CommandDefinition } from '@zupfnoter/core'
import type { ConsoleLogEntry } from '../consoleLog'

const props = defineProps<{
  lines: ConsoleLogEntry[]
  resolveCommand: (command: string) => { completed: string; didYouMean: string[] } | undefined
  getCommand: (commandName: string) => CommandDefinition | undefined
  busy?: boolean
}>()

const emit = defineEmits<{
  (event: 'execute', command: string): void
  (event: 'info', message: string): void
}>()

const commandText = ref('')
const commandHistory = ref<string[]>([])
const historyCursor = ref<number | undefined>(undefined)
const logElement = ref<HTMLElement | null>(null)
const inputElement = ref<HTMLInputElement | null>(null)

function submitCommand(): void {
  if (props.busy === true) return
  const command = commandText.value.trim()
  if (command === '') return
  const [commandName, ...args] = command.split(/\s+/)
  if (commandName === undefined || commandName === '') return
  const suggestion = props.resolveCommand(command)
  const resolvedCommand = suggestion?.completed ?? command
  const resolvedName = resolvedCommand.split(/\s+/, 1)[0]
  const exactCommand = props.getCommand(resolvedName ?? commandName)
  if (exactCommand === undefined) {
    const hint = suggestion?.didYouMean.length ? suggestion.didYouMean.join(', ') : suggestion?.completed
    emit('info', `did you mean: ${hint ?? commandName}?`)
    return
  }
  if (suggestion !== undefined && suggestion.didYouMean.length > 0 && suggestion.completed === command) {
    emit('info', `did you mean: ${suggestion.didYouMean.join(', ')}?`)
    return
  }
  const requiredParameters = exactCommand.parameters?.filter((parameter) => parameter.defaultValue === undefined) ?? []
  if (args.length < requiredParameters.length) {
    const missingParameter = requiredParameters[args.length]
    if (missingParameter !== undefined) {
      const usage = buildUsage(exactCommand.name, exactCommand.parameters ?? [])
      emit('info', `missing <${missingParameter.name}> for ${exactCommand.name} (${missingParameter.help}). usage: ${usage}`)
    }
    return
  }
  emit('execute', resolvedCommand)
  commandHistory.value = [...commandHistory.value.filter((entry) => entry !== resolvedCommand), resolvedCommand].slice(-100)
  historyCursor.value = undefined
  commandText.value = ''
  window.setTimeout(() => {
    focusInput()
  }, 0)
}

function applyCompletion(): void {
  if (props.busy === true) return
  const suggestion = props.resolveCommand(commandText.value)
  if (suggestion === undefined) return
  if (suggestion.completed.length > commandText.value.length) {
    commandText.value = suggestion.completed
    return
  }
  if (suggestion.didYouMean.length > 0) {
    emit('info', `did you mean: ${suggestion.didYouMean.join(', ')}?`)
  }
}

function buildUsage(commandName: string, parameters: CommandDefinition['parameters']): string {
  if (parameters === undefined || parameters.length === 0) {
    return commandName
  }
  const parts = parameters.map((parameter) => parameter.defaultValue === undefined
    ? `<${parameter.name}>`
    : `[<${parameter.name}>]`)
  return [commandName, ...parts].join(' ')
}

function navigateHistory(direction: 'previous' | 'next'): void {
  if (props.busy === true) return
  const history = commandHistory.value
  if (history.length === 0) return

  if (direction === 'previous') {
    historyCursor.value = historyCursor.value === undefined
      ? history.length - 1
      : Math.max(0, historyCursor.value - 1)
  } else {
    if (historyCursor.value === undefined) return
    historyCursor.value = historyCursor.value + 1
    if (historyCursor.value >= history.length) {
      historyCursor.value = undefined
      commandText.value = ''
      return
    }
  }

  if (historyCursor.value !== undefined) {
    commandText.value = history[historyCursor.value] ?? ''
  }
}

function handleInputKeydown(event: KeyboardEvent): void {
  if (props.busy === true) {
    event.preventDefault()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    submitCommand()
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    applyCompletion()
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    navigateHistory('previous')
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    navigateHistory('next')
  }
}

function focusInput(): void {
  inputElement.value?.focus()
}

function handlePanelClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof HTMLInputElement) return
  focusInput()
}

function entryPrefix(entry: ConsoleLogEntry): string {
  if (entry.kind === 'command') return '>'
  if (entry.kind === 'error') return '!'
  if (entry.kind === 'info') return '#'
  return ''
}

function scrollToBottom(): void {
  const element = logElement.value
  if (element === null) return
  element.scrollTop = element.scrollHeight
}

watch(
  () => props.lines.length,
  async () => {
    await nextTick()
    scrollToBottom()
  },
  { immediate: true },
)

onMounted(() => {
  focusInput()
})
</script>

<template>
  <ZnPanel tone="sunken">
    <template #header>
      <ZnPanelHeader eyebrow="Debug" title="Console" subtitle="Protokoll und Statusmeldungen der Workbench" />
    </template>

    <div class="console-panel" @click="handlePanelClick">
      <div
        ref="logElement"
        class="console-panel__log"
        role="log"
        aria-live="polite"
      >
        <div class="console-panel__terminal">
          <div
            v-for="line in lines"
            :key="line.id"
            class="console-panel__line"
            :class="`console-panel__line--${line.kind}`"
          >
            <span class="console-panel__prefix">{{ entryPrefix(line) }}</span>
            <span class="console-panel__message">{{ line.message }}</span>
          </div>
          <label class="console-panel__line console-panel__line--active">
            <span class="console-panel__prefix">&gt;</span>
            <input
              ref="inputElement"
              v-model="commandText"
              class="console-panel__input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              aria-label="Command"
              :disabled="busy === true"
              @keydown="handleInputKeydown"
            >
          </label>
        </div>
      </div>
    </div>
  </ZnPanel>
</template>

<style scoped>
.console-panel {
  min-height: 0;
  height: 100%;
}

.console-panel__log {
  height: 100%;
  min-height: 0;
  padding: 0.85rem 0.95rem;
  border-radius: var(--zn-radius-sm);
  border: 1px solid color-mix(in srgb, var(--zn-border-strong) 68%, black);
  background:
    linear-gradient(180deg, rgb(11 18 20 / 0.98), rgb(5 9 11 / 0.98));
  color: rgb(213 226 218);
  font-family: var(--zn-font-mono);
  font-size: 0.82rem;
  line-height: 1.55;
  overflow: auto;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
}

.console-panel__terminal {
  min-height: 100%;
}

.console-panel__line {
  display: grid;
  grid-template-columns: 1.4rem minmax(0, 1fr);
  gap: 0.45rem;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.console-panel__line::selection,
.console-panel__line *::selection {
  background: rgb(70 102 145 / 0.72);
  color: rgb(245 248 252);
}

.console-panel__line::-moz-selection,
.console-panel__line *::-moz-selection {
  background: rgb(70 102 145 / 0.72);
  color: rgb(245 248 252);
}

.console-panel__prefix {
  color: rgb(112 136 126);
  user-select: none;
}

.console-panel__line--command {
  color: rgb(154 214 177);
}

.console-panel__line--info {
  color: rgb(135 197 218);
}

.console-panel__line--error {
  color: rgb(255 139 123);
}

.console-panel__line--output {
  color: rgb(222 228 221);
}

.console-panel__line--active {
  color: rgb(154 214 177);
}

.console-panel__input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: var(--zn-font-mono);
  font-size: inherit;
  line-height: inherit;
  caret-color: rgb(154 214 177);
}

.console-panel__terminal,
.console-panel__log {
  user-select: text;
}

.console-panel__input:focus {
  outline: none;
}
</style>
