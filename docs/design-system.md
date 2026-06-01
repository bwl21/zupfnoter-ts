# Zupfnoter Design-System

Zentrales Nachschlage-Dokument für die `Zn*`-Basiskomponenten im `apps/web`-Frontend.
Das Design-System ist bewusst klein gehalten: Es liefert wiederverwendbare Bausteine
für die Workbench, aber keine Fachlogik.

## Grundprinzipien

- Tokens zuerst: Farben, Abstände, Schatten und Typografie kommen aus
  [apps/web/src/design-system/tokens.css](/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts/apps/web/src/design-system/tokens.css).
- Komponenten bleiben generisch und bekommen Verhalten über Props und Slots.
- Fachliche Besonderheiten gehören in Workbench- oder Panel-Komponenten, nicht in das
  Design-System selbst.
- Wenn mehrere Instanzen unterschiedlich aussehen, dann wegen Props oder umgebendem
  Wrapper-Markup, nicht weil die Komponente „von selbst“ Sonderfälle kennt.

## Komponenten-Index

| Komponente | Zweck | Wichtige Props | Typische Verwendung |
|---|---|---|---|
| `ZnButton` | Standard-Button | `variant`, `type`, `disabled` | Toolbar-Aktionen, primäre/sekundäre Aktionen |
| `ZnIconButton` | Kompakter Icon-Button | `label`, `variant` | Kleine Symbolaktionen in Toolbars oder Controls |
| `ZnToolbar` | Horizontale Leiste für Aktionen | Slots `leading`, default, `trailing` | Kopfzeilen, Bereichsaktionen, Statusleisten |
| `ZnPanel` | Visuelle Grundfläche für Arbeitsbereiche | `tone`, `title`, `subtitle`, `eyebrow` | Editor-, Preview- und Debug-Panels |
| `ZnPanelHeader` | Standardkopf für `ZnPanel` | `eyebrow`, `title`, `subtitle` | Einheitliche Panel-Titelzeilen |
| `ZnPanelBody` | Inhaltsbereich innerhalb eines Panels | - | Wenn Body-Styling explizit getrennt werden soll |
| `ZnTabs` | Tab-Leiste mit Panel-Slot | `modelValue`, `items`, `fillHeight` | Editor-Tabs, Preview-Modi |
| `ZnSplitPane` | Resizable Split-Container | `orientation`, `primarySize`, `minPrimarySize`, `maxPrimarySize`, `handleSize` | Linke/rechte oder obere/untere Pane-Aufteilung |
| `ZnStatusBar` | Kompakte Statuszeile | Slots / Statuswerte | Footer, Laufzeitstatus, Modus-Anzeige |
| `ZnBadge` | Status- oder Kontextmarke | `tone` | Extract, Warnung, Status, Info |
| `ZnProblemMarker` | Marker für Fehler-/Warnkontext | `tone` | Diagnostik, Parity, Problemstellen |
| `ZnZoomControl` | Zoom-Regler | `v-model` | Vorschau-Zoom in der unteren Preview |

## Verwendung

### `ZnPanel`

Standardhülle für Inhalte mit konsistenter Optik.

```vue
<ZnPanel tone="surface">
  <template #header>
    <ZnPanelHeader title="ABC" subtitle="Quelltext" />
  </template>

  <div>Inhalt</div>
</ZnPanel>
```

`tone` steuert die Panel-Anmutung:
- `surface`: Standard
- `sunken`: etwas zurückgesetzt
- `accent`: akzentuiert

### `ZnTabs`

Tab-Leiste mit aktivem Panel-Slot. `fillHeight` entscheidet, ob die Komponente die
volle Höhe einnimmt oder nur so groß wie ihr Inhalt ist.

```vue
<ZnTabs v-model="activeTab" :items="tabs" :fill-height="false">
  <template #default="{ activeId }">
    <PanelA v-if="activeId === 'a'" />
    <PanelB v-else />
  </template>
</ZnTabs>
```

### `ZnSplitPane`

Geteiltes Layout mit Drag- und Tastatursteuerung.

```vue
<ZnSplitPane v-model:primary-size="leftSize" :min-primary-size="12" :max-primary-size="88">
  <template #primary>Links</template>
  <template #secondary>Rechts</template>
</ZnSplitPane>
```

`orientation="vertical"` schaltet auf obere/untere Teilung um.

### `ZnToolbar`

Reine Hülle für Aktionen. Die Toolbar entscheidet nicht über die Fachlogik, sondern
ordnet nur Inhalte.

```vue
<ZnToolbar>
  <template #leading>
    <ZnButton variant="ghost">Datei</ZnButton>
  </template>
  <template #trailing>
    <ZnButton variant="primary">Speichern</ZnButton>
  </template>
</ZnToolbar>
```

## Tokens

Für neue Komponenten sollen möglichst die vorhandenen Tokens verwendet werden:

- `--zn-bg`, `--zn-bg-elevated`, `--zn-bg-surface`, `--zn-bg-surface-soft`
- `--zn-border`, `--zn-border-strong`
- `--zn-text`, `--zn-text-soft`, `--zn-text-muted`, `--zn-heading`
- `--zn-accent`, `--zn-accent-strong`, `--zn-accent-soft`
- `--zn-success`, `--zn-warning`, `--zn-danger`, `--zn-info`
- `--zn-shadow`, `--zn-shadow-soft`
- `--zn-radius-*`, `--zn-space-*`

Direkte Hex- oder RGBA-Werte sollten nur dann verwendet werden, wenn sie fachlich
notwendig sind oder bewusst als Übergangsmaßnahme dokumentiert werden.

## Workbench-Nutzung

Die aktuelle Workbench verwendet das Design-System so:

- globale Kopfzeile: `ZnToolbar` + `ZnButton` + `ZnBadge`
- Editorbereich: `ZnToolbar`, `ZnTabs`, `ZnPanel`
- Vorschau: `ZnSplitPane`, `ZnPanel`, `ZnZoomControl`
- Footer: `ZnStatusBar` und `ZnBadge`

Diese Aufteilung ist absichtlich homogen: dieselben Grundkomponenten sollen in
verschiedenen Bereichen ähnlich wirken, solange keine fachliche Ausnahme nötig ist.

## Pflegehinweis

Wenn eine neue `Zn*`-Komponente entsteht oder eine bestehende sich in Props oder Slots
ändert, sollte dieser Index mitgezogen werden. Das ist die zentrale Einstiegseite für
die Design-System-Nutzung im `docs/`-Baum.
