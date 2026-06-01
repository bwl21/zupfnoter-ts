# Agent Prompt: Recovery and Session Management

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Recovery and Session Management**.

## Architekturstand


- Phase 5 bleibt Single-Document.
- Recovery-Slots sind tab-/sessionbezogen.
- Mehrere Tabs überschreiben sich nicht.
- Offene Tabs werden nicht zur Recovery angeboten.
- Dokumentwechsel ersetzt den Recovery-Slot der aktuellen Session.
- Recovery-Dialog zeigt Session-ID, Filename, Titel, StoragePath, localUpdatedAt, cloudSavedAt, Dirty.


## Aufgabe


- `RecoverySlot` modellieren.
- Session-ID pro Tab verwalten.
- RecoverySlot bei Dokumentänderung aktualisieren.
- Dokumentwechsel ersetzt Slot.
- Liveness/Heartbeat-Konzept vorbereiten.
- Recovery-Dialog mit Slot-Auswahl vorbereiten.


## Arbeitsweise

1. Analysiere zuerst die vorhandene Projektstruktur.
2. Verwende bestehende Konventionen, statt neue Parallelstrukturen zu erfinden.
3. Implementiere in kleinen Schritten.
4. Vermeide große Refactorings außerhalb des Arbeitspakets.
5. Ergänze Tests oder dokumentiere, warum noch keine Tests sinnvoll möglich sind.
6. Aktualisiere am Ende `01_thema.md` mit dem Bearbeitungsstatus.

## Akzeptanzkriterien

- Die Umsetzung verletzt keine Architekturentscheidung dieses Arbeitspakets.
- Es entstehen keine versteckten UI-Sonderlogiken, die später Core/Worker/Stores ersetzen.
- Fachlogik bleibt dort, wo sie laut Architektur hingehört.
- Typecheck/Lint/Test laufen oder Abweichungen sind dokumentiert.

## Nicht-Ziele

- Keine vollständige Legacy-Parität in einem Schritt.
- Keine großen Umbauten außerhalb der direkt notwendigen Dateien.
- Keine Einführung einer schwergewichtigen Architektur, wenn ein kleiner Adapter reicht.


## Zielmodell

```ts
interface RecoverySlot {
  sessionId: string
  filenameFromF?: string
  titleFromABC?: string
  storagePath?: string
  localUpdatedAt: string
  cloudSavedAt?: string
  dirty: boolean
  heartbeatAt?: string
  closedCleanly?: boolean
  abcText: string
  serializedConfig: unknown
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Recovery and Session Management

## Angelegte/geänderte Dateien

...

## Entscheidungen

...

## Tests / Checks

...

## Nicht umgesetzt

...

## Nächste Schritte

...
```

## Mögliche Dateien / Suchorte

Mögliche Suchorte:
- localStorage/IndexedDB Nutzung
- DocumentStore
- StorageStore
- App startup
