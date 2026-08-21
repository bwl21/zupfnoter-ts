import { describe, expect, it } from 'vitest'

import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { HarpnotesLayout } from '../../HarpnotesLayout.js'
import { practiceQrJpegDataUrl } from '../../practiceQr.js'
import { SvgEngine } from '../../SvgEngine.js'
import { loadFixture } from '../fixtureLoader.js'
import { extractSongResources } from '../../extractSongConfig.js'

describe('Practice QR image fixture', () => {
  it('keeps the configured top-edge position through the full render pipeline', () => {
    const fixture = loadFixture('player-qr-position')
    const song = new AbcToSong().transform(new AbcParser().parse(fixture.input.abc), fixture.config)
    const sheet = new HarpnotesLayout(fixture.config, {
      imageResolver: (imageName) => imageName === '$player_qr'
        ? practiceQrJpegDataUrl('https://practice.example.test/song')
        : extractSongResources(fixture.input.abc)[imageName]?.join(''),
    }).layout(song, 0, 'A4')
    const svg = new SvgEngine().draw(sheet)
    const imageGroup = svg.match(
      /<g id="zn-image-extract-0-images-0-pos-0"[\s\S]*?<image\b[^>]*>/,
    )?.[0]

    expect(imageGroup).toBeDefined()
    expect(imageGroup).toContain('x="120"')
    expect(imageGroup).toContain('y="80"')
    expect(imageGroup).toContain('height="40"')

    const sourceImageGroup = svg.match(
      /<g id="zn-image-extract-0-images-1-pos-1"[\s\S]*?<image\b[^>]*>/,
    )?.[0]
    expect(sourceImageGroup).toContain('x="30"')
    expect(sourceImageGroup).toContain('y="50"')
    expect(sourceImageGroup).toContain('height="32"')
  })
})
