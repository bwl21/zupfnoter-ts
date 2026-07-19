# Song Gap Report

Global overview for case-based song parity.
The per-case artifacts live under `fixtures/cases/<area>/<case>/_parity/song/`.

## Summary

- Cases with reports: 14
- Required gaps: 288
- Warnings: 26

## Gap Type Overview

| Gap category | Count |
| --- | ---: |
| different-length | 2 |
| different-value | 19 |
| extra-event | 66 |
| extra-field | 127 |
| ignored-by-contract | 1716 |
| missing-event | 74 |
| normalization-warning | 26 |

## Case Reports

- [246_Horch-was-kommt-von-draussen-rein](fixtures/cases/protected/246_Horch-was-kommt-von-draussen-rein/_parity/song/reports/song-gap-report.md)
  - Required gaps: 46
  - Warnings: 3
  - Matched events: 356
  - Unmatched legacy events: 16
  - Unmatched TS events: 10

- [3015_reference_sheet](fixtures/cases/public/3015_reference_sheet/_parity/song/reports/song-gap-report.md)
  - Required gaps: 126
  - Warnings: 3
  - Matched events: 79
  - Unmatched legacy events: 54
  - Unmatched TS events: 52

- [694_Sheep-may-safely-graze](fixtures/cases/protected/694_Sheep-may-safely-graze/_parity/song/reports/song-gap-report.md)
  - Required gaps: 10
  - Warnings: 0
  - Matched events: 599
  - Unmatched legacy events: 4
  - Unmatched TS events: 4

- [757_Andante-grazioso-Mozart](fixtures/cases/protected/757_Andante-grazioso-Mozart/_parity/song/reports/song-gap-report.md)
  - Required gaps: 51
  - Warnings: 10
  - Matched events: 354
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [783_einsiedler-kreuzweg](fixtures/cases/protected/783_einsiedler-kreuzweg/_parity/song/reports/song-gap-report.md)
  - Required gaps: 4
  - Warnings: 0
  - Matched events: 132
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [abc-to-song-slur-tuplet-parity](fixtures/cases/public/abc-to-song-slur-tuplet-parity/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 2
  - Matched events: 10
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [decoration](fixtures/cases/public/decoration/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 8
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [lyrics](fixtures/cases/public/lyrics/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 8
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [pause](fixtures/cases/public/pause/_parity/song/reports/song-gap-report.md)
  - Required gaps: 3
  - Warnings: 0
  - Matched events: 12
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [repeat](fixtures/cases/public/repeat/_parity/song/reports/song-gap-report.md)
  - Required gaps: 41
  - Warnings: 8
  - Matched events: 80
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [single_note](fixtures/cases/public/single_note/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 2
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [tie](fixtures/cases/public/tie/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 8
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [tuplet](fixtures/cases/public/tuplet/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 10
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [two_voices](fixtures/cases/public/two_voices/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 12
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

## Manual Registry

`fixtures/openImplementations.ts` remains the manually curated list for systematic gaps.
