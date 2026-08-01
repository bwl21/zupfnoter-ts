import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'

import { readLocalImport, resourceKeyFromFileName } from '../fileImport'

describe('readLocalImport', () => {
  it('reads ABC files as text', async () => {
    const result = await readLocalImport(new File(['X:1\nT:Test\nK:C\nC'], 'test.abc', { type: 'text/plain' }))

    expect(result).toEqual({ kind: 'abc', text: 'X:1\nT:Test\nK:C\nC' })
  })

  it('reads JPEG files as data URIs', async () => {
    const result = await readLocalImport(new File([new Uint8Array([0xff, 0xd8])], 'cover.jpg', { type: 'image/jpeg' }))

    expect(result).toEqual({ kind: 'resource', name: 'cover.jpg', dataUri: 'data:image/jpeg;base64,/9g=' })
  })

  it('reads PNG files as data URIs', async () => {
    const result = await readLocalImport(new File([new Uint8Array([0x89, 0x50])], 'second.png', { type: 'image/png' }))

    expect(result).toEqual({ kind: 'resource', name: 'second.png', dataUri: 'data:image/png;base64,iVA=' })
  })

  it('converts MusicXML instead of importing XML as raw ABC', async () => {
    const musicXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<score-partwise version="3.1">',
      '<work><work-title>Test</work-title></work>',
      '<part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>',
      '<part id="P1"><measure number="1">',
      '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>',
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>',
      '</measure></part></score-partwise>',
    ].join('')
    const promise = readLocalImport(new File([musicXml], 'test.xml', { type: 'application/xml' }))

    await expect(promise).resolves.toMatchObject({ kind: 'abc' })
    await expect(promise).resolves.toMatchObject({ text: expect.stringContaining('K:C') })
  })

  it('selects the root score XML before META-INF/container.xml like Legacy', async () => {
    const musicXml = '<score-partwise><part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>'
    const archive = zipSync({
      'META-INF/container.xml': new TextEncoder().encode('<container><rootfiles><rootfile full-path="score.xml" /></rootfiles></container>'),
      'score.xml': new TextEncoder().encode(musicXml),
    })

    const result = await readLocalImport(new File([archive], 'test.mxl', { type: 'application/vnd.recordare.musicxml' }))

    expect(result.kind).toBe('abc')
  })
})

describe('resourceKeyFromFileName', () => {
  it('uses the legacy-safe resource key format', () => {
    expect(resourceKeyFromFileName('mein bild-01.jpg')).toBe('mein_bild_01_jpg')
  })
})
