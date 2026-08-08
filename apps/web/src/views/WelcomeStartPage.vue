<script setup lang="ts">
import logoUrl from '../assets/logo.svg'

defineEmits<{
  'open-example': []
  'open-own': []
}>()
</script>

<template>
  <main class="welcome-start" data-testid="welcome-start-page">
    <section class="welcome-start__card" aria-labelledby="welcome-start-title">
      <div class="welcome-start__brand">
        <img :src="logoUrl" alt="" class="welcome-start__logo">
        <span>Zupfnoter-ts</span>
      </div>
      <p class="welcome-start__eyebrow">Die Weiterentwicklung von Zupfnoter</p>
      <h1 id="welcome-start-title">Willkommen bei Zupfnoter-ts</h1>
      <p class="welcome-start__intro">
        Ihre bestehenden Stücke bleiben erhalten. Lernen Sie die neue Oberfläche an einem echten Musikstück kennen – oder öffnen Sie direkt Ihren eigenen Bestand.
      </p>

      <div class="welcome-start__actions">
        <button type="button" class="welcome-start__action welcome-start__action--primary" @click="$emit('open-example')">
          <strong>Beispielstück öffnen</strong>
          <span>„Ich steh an deiner Krippen hier“</span>
        </button>
        <button type="button" class="welcome-start__action" @click="$emit('open-own')">
          <strong>Eigenes Stück öffnen</strong>
          <span>Eine ABC-Datei aus Ihrem Bestand laden</span>
        </button>
      </div>

      <div class="welcome-start__promise">
        <span class="welcome-start__check" aria-hidden="true">✓</span>
        <p><strong>Keine Umstellung nötig.</strong> Ihre bisherigen Stücke sollen genauso aussehen wie bisher.</p>
      </div>
    </section>
  </main>
</template>
