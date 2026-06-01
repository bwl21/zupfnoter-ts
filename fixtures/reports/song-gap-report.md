# Song Gap Report

Global overview for case-based song parity.
The per-case artifacts live under `fixtures/cases/<case>/_parity/song/`.

## Summary

- Cases with reports: 15
- Required gaps: 277
- Warnings: 21

## Gap Type Overview

| Gap category | Count |
| --- | ---: |
| different-length | 2 |
| different-value | 9 |
| extra-event | 74 |
| extra-field | 110 |
| ignored-by-contract | 1700 |
| missing-event | 82 |
| normalization-warning | 21 |

## Case Reports

- [246_Horch-was-kommt-von-draussen-rein](fixtures/cases/246_Horch-was-kommt-von-draussen-rein/_parity/song/reports/song-gap-report.md)
  - Required gaps: 55
  - Warnings: 3
  - Matched events: 350
  - Unmatched legacy events: 22
  - Unmatched TS events: 16

- [3015_reference_sheet](fixtures/cases/3015_reference_sheet/_parity/song/reports/song-gap-report.md)
  - Required gaps: 130
  - Warnings: 3
  - Matched events: 77
  - Unmatched legacy events: 56
  - Unmatched TS events: 54

- [694_Sheep-may-safely-graze](fixtures/cases/694_Sheep-may-safely-graze/_parity/song/reports/song-gap-report.md)
  - Required gaps: 10
  - Warnings: 0
  - Matched events: 599
  - Unmatched legacy events: 4
  - Unmatched TS events: 4

- [757_Andante-grazioso-Mozart](fixtures/cases/757_Andante-grazioso-Mozart/_parity/song/reports/song-gap-report.md)
  - Required gaps: 51
  - Warnings: 10
  - Matched events: 354
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [783_einsiedler-kreuzweg](fixtures/cases/783_einsiedler-kreuzweg/_parity/song/reports/song-gap-report.md)
  - Required gaps: 4
  - Warnings: 0
  - Matched events: 132
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [abc-to-song-slur-tuplet-parity](fixtures/cases/abc-to-song-slur-tuplet-parity/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 2
  - Matched events: 10
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [decoration](fixtures/cases/decoration/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 8
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [lyrics](fixtures/cases/lyrics/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 8
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [pause](fixtures/cases/pause/_parity/song/reports/song-gap-report.md)
  - Required gaps: 3
  - Warnings: 0
  - Matched events: 12
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [repeat](fixtures/cases/repeat/_parity/song/reports/song-gap-report.md)
  - Required gaps: 9
  - Warnings: 2
  - Matched events: 10
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [single_note](fixtures/cases/single_note/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 2
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [tie](fixtures/cases/tie/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 8
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [tuplet](fixtures/cases/tuplet/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 10
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [two_voices](fixtures/cases/two_voices/_parity/song/reports/song-gap-report.md)
  - Required gaps: 1
  - Warnings: 0
  - Matched events: 12
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

- [Twostaff](fixtures/cases/Twostaff/_parity/song/reports/song-gap-report.md)
  - Required gaps: 8
  - Warnings: 1
  - Matched events: 59
  - Unmatched legacy events: 0
  - Unmatched TS events: 0

## Manual Registry

`fixtures/openImplementations.ts` remains the manually curated list for systematic gaps.
