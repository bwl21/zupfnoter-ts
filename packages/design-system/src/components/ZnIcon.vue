<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

import { ZN_ICONS, type ZnIconName } from '../icons'

const props = defineProps<{
  name: ZnIconName
}>()
</script>

<template>
  <FontAwesomeIcon :icon="ZN_ICONS[props.name]" aria-hidden="true" />
</template>
