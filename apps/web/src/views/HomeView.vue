<script setup lang="ts">
import { inject, ref } from 'vue'

import ZupfnoterWorkbench from '../workbench/ZupfnoterWorkbench.vue'
import WelcomeStartPage from './WelcomeStartPage.vue'
import { INITIAL_DOCUMENT_KEY } from '../workbench/documentPersistence'

const initialDocument = inject(INITIAL_DOCUMENT_KEY)
const showWelcome = ref(initialDocument === undefined && import.meta.env.MODE !== 'test')
const openStorageOnStart = ref(false)

function openExample(): void {
  openStorageOnStart.value = false
  showWelcome.value = false
}

function openOwnDocument(): void {
  openStorageOnStart.value = true
  showWelcome.value = false
}
</script>

<template>
  <WelcomeStartPage v-if="showWelcome" @open-example="openExample" @open-own="openOwnDocument" />
  <ZupfnoterWorkbench v-else :open-storage-on-mount="openStorageOnStart" />
</template>
