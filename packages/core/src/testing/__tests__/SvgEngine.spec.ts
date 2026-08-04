import { describe, it, expect } from 'vitest'
import { SvgEngine } from '../../SvgEngine.js'
import type { Sheet, Ellipse, FlowLine, Glyph, Annotation, Path, Image } from '@zupfnoter/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSheet(children: Sheet['children']): Sheet {
  return { children, activeVoices: [1] }
}

function filledEllipse(overrides: Partial<Ellipse> = {}): Ellipse {
  return {
    type: 'Ellipse',
    center: [50, 100],
    size: [3.5, 1.7],
    fill: 'filled',
    dotted: false,
    rect: false,
    hasbarover: false,
    color: 'black',
    lineWidth: 0.5,
    visible: true,
    ...overrides,
  }
}

function emptyEllipse(overrides: Partial<Ellipse> = {}): Ellipse {
  return filledEllipse({ fill: 'empty', ...overrides })
}

function flowLine(overrides: Partial<FlowLine> = {}): FlowLine {
  return {
    type: 'FlowLine',
    from: [10, 20],
    to: [10, 40],
    style: 'solid',
    color: 'black',
    lineWidth: 0.3,
    visible: true,
    ...overrides,
  }
}

function glyph(overrides: Partial<Glyph> = {}): Glyph {
  return {
    type: 'Glyph',
    center: [50, 100],
    size: [4, 2],
    glyphName: 'rest_4',
    dotted: false,
    fill: 'filled',
    color: 'black',
    lineWidth: 0.3,
    visible: true,
    ...overrides,
  }
}

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    type: 'Annotation',
    center: [20, 30],
    text: 'Hello',
    style: 'regular',
    color: 'black',
    lineWidth: 0,
    visible: true,
    ...overrides,
  }
}

function pathEl(overrides: Partial<Path> = {}): Path {
  return {
    type: 'Path',
    path: [[10, 20], [30, 40], [50, 20]],
    fill: false,
    color: 'black',
    lineWidth: 0.3,
    visible: true,
    ...overrides,
  }
}

function image(overrides: Partial<Image> = {}): Image {
  return {
    type: 'Image',
    url: 'https://example.com/harp.png',
    position: [10, 50],
    height: 30,
    color: 'none',
    lineWidth: 0,
    visible: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SvgEngine', () => {
  const engine = new SvgEngine({ width: 400, height: 282 })

  describe('draw(sheet)', () => {
    it('returns a valid SVG wrapper', () => {
      const svg = engine.draw(makeSheet([]))
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
      expect(svg).toMatch(/<\/svg>$/)
    })

    it('includes a border rect', () => {
      const svg = engine.draw(makeSheet([]))
      expect(svg).toContain('<rect ')
      expect(svg).toContain('width="398"')
    })

    it('skips invisible elements', () => {
      const svg = engine.draw(makeSheet([filledEllipse({ visible: false })]))
      // Only the border rect should be present, no ellipse
      expect(svg.match(/<ellipse/g)?.length ?? 0).toBe(0)
    })

    it('marks only explicitly draggable elements in interactive mode', () => {
      const interactive = new SvgEngine({ width: 400, height: 282, interactive: true })
      const svg = interactive.draw(makeSheet([
        annotation({
          confKey: 'extract.images.0.pos',
          draginfo: { handler: 'annotation' },
        }),
        annotation({ confKey: 'extract.images.1.pos' }),
      ]))

      expect(svg).toContain('data-drag-enabled="true"')
      expect(svg).toContain('data-drag-handler="annotation"')
      expect(svg).toContain('data-drag-value="[20,30]"')
      expect(svg.match(/data-drag-enabled="true"/g)?.length ?? 0).toBe(1)
    })

    it('adds a wide diagnostic hitbox for interactive jumplines', () => {
      const interactive = new SvgEngine({ width: 400, height: 282, interactive: true })
      const svg = interactive.draw(makeSheet([
        pathEl({
          confKey: 'extract.0.jumpline.test',
          draginfo: {
            handler: 'jumpline',
            xspacing: 10,
            jumpline: {
              from: { center: [10, 20], size: [2, 1], anchor: 'after' },
              to: { center: [30, 60], size: [2, 1], anchor: 'before' },
              vertical: 10,
              vertical_anchor: 'from',
              jumpline_anchor: [1, 1],
              verticalcut: 0,
            },
          },
        }),
      ]))

      expect(svg).toContain('data-drag-handler="jumpline"')
      expect(svg).toContain('data-drag-hitbox="true"')
      expect(svg).toContain('class="zupfnoter-jumpline-hitbox"')
      expect(svg).toContain('stroke-width="10.3"')
    })

    it('renders editable Bézier handles for interactive flowconf paths', () => {
      const interactive = new SvgEngine({ width: 400, height: 282, interactive: true })
      const svg = interactive.draw(makeSheet([
        pathEl({
          pathData: 'M10 20c0 10 0 10 0 20',
          confKey: 'extract.0.notebound.flowline.v_1.42',
          draginfo: {
            handler: 'bezier',
            bezier: {
              from: [10, 20],
              to: [10, 40],
              cp1: [10, 30],
              cp2: [10, 30],
            },
          },
        }),
      ]))

      expect(svg).toContain('data-drag-handler="bezier"')
      expect(svg).toContain('data-drag-bezier=')
      expect(svg).toContain('data-bezier-control="cp1"')
      expect(svg).toContain('data-bezier-control="cp2"')
    })

    it('renders tuplet control lines even in non-interactive output', () => {
      const legacyCompatible = new SvgEngine({ width: 400, height: 282 })
      const svg = legacyCompatible.draw(makeSheet([
        pathEl({
          pathData: 'M10 20c3 4 7 4 10 0',
          confKey: 'extract.0.notebound.tuplet.v_1.42',
          draginfo: {
            handler: 'tuplet',
            p1: [10, 20],
            p2: [20, 20],
            cp1: [13, 24],
            cp2: [17, 24],
          },
        }),
      ]))

      expect(svg.match(/data-bezier-control=/g)?.length ?? 0).toBe(2)
      expect(svg).not.toContain('data-bezier-polygon="true"')

      const interactive = new SvgEngine({ width: 400, height: 282, interactive: true })
      const interactiveSvg = interactive.draw(makeSheet([
        pathEl({
          pathData: 'M10 20c3 4 7 4 10 0',
          confKey: 'extract.0.notebound.tuplet.v_1.42.*',
          draginfo: {
            handler: 'tuplet',
            p1: [10, 20],
            p2: [20, 20],
            cp1: [13, 24],
            cp2: [17, 24],
            conf_key: 'extract.0.notebound.tuplet.v_1.42',
          },
        }),
      ]))
      expect(interactiveSvg).toContain('data-drag-handler="tuplet"')
      expect(interactiveSvg).toContain('data-drag-bezier=')
    })
  })

  describe('Ellipse', () => {
    it('renders filled ellipse with correct attributes', () => {
      const svg = engine.draw(makeSheet([filledEllipse()]))
      expect(svg).toContain('<ellipse ')
      expect(svg).toContain('cx="50"')
      expect(svg).toContain('cy="100"')
      expect(svg).toContain('fill="black"')
    })

    it('renders empty ellipse with white fill and colored stroke', () => {
      const svg = engine.draw(makeSheet([emptyEllipse()]))
      // Should have white background ellipse + stroked ellipse
      expect(svg).toContain('fill="white"')
      expect(svg).toContain('stroke="black"')
    })

    it('renders dotted ellipse with augmentation dot', () => {
      const svg = engine.draw(makeSheet([filledEllipse({ dotted: true })]))
      // Two ellipses for the dot (white bg + filled dot) plus the main ellipse
      const ellipseCount = (svg.match(/<ellipse/g) ?? []).length
      expect(ellipseCount).toBeGreaterThanOrEqual(3)
    })

    it('renders hasbarover with a rect above the ellipse', () => {
      const svg = engine.draw(makeSheet([filledEllipse({ hasbarover: true })]))
      // Should contain a rect for the barover (in addition to the border rect)
      const rectCount = (svg.match(/<rect/g) ?? []).length
      expect(rectCount).toBeGreaterThanOrEqual(2)
    })

    it('uses variant color', () => {
      const svg = engine.draw(makeSheet([filledEllipse({ color: 'red' })]))
      expect(svg).toContain('fill="red"')
    })
  })

  describe('FlowLine', () => {
    it('renders a solid line', () => {
      const svg = engine.draw(makeSheet([flowLine()]))
      expect(svg).toContain('<line ')
      expect(svg).toContain('x1="10"')
      expect(svg).toContain('y1="20"')
      expect(svg).toContain('x2="10"')
      expect(svg).toContain('y2="40"')
      expect(svg).not.toContain('stroke-dasharray')
    })

    it('renders a dashed line', () => {
      const svg = engine.draw(makeSheet([flowLine({ style: 'dashed' })]))
      expect(svg).toContain('stroke-dasharray')
    })

    it('renders a dotted line', () => {
      const svg = engine.draw(makeSheet([flowLine({ style: 'dotted' })]))
      expect(svg).toContain('stroke-dasharray')
    })
  })

  describe('Glyph', () => {
    it('renders a glyph path with transform', () => {
      const svg = engine.draw(makeSheet([glyph()]))
      expect(svg).toContain('<path ')
      expect(svg).toContain('translate(50,100)')
    })

    it('renders white background rect for glyph', () => {
      const svg = engine.draw(makeSheet([glyph()]))
      // Border rect + glyph background rect
      const rectCount = (svg.match(/<rect/g) ?? []).length
      expect(rectCount).toBeGreaterThanOrEqual(2)
    })

    it('renders dotted glyph with augmentation dot', () => {
      const svg = engine.draw(makeSheet([glyph({ dotted: true })]))
      const ellipseCount = (svg.match(/<ellipse/g) ?? []).length
      expect(ellipseCount).toBeGreaterThanOrEqual(2)
    })

    it('returns empty string for unknown glyph name', () => {
      const svg = engine.draw(makeSheet([glyph({ glyphName: 'unknown_glyph' })]))
      // No path element for the glyph (only border rect)
      expect(svg).not.toContain('translate(50,100)')
    })
  })

  describe('Path', () => {
    it('renders a path element', () => {
      const svg = engine.draw(makeSheet([pathEl()]))
      expect(svg).toContain('<path ')
      expect(svg).toContain('M10,20')
      expect(svg).toContain('L30,40')
    })

    it('renders filled path', () => {
      const svg = engine.draw(makeSheet([pathEl({ fill: true, color: 'blue' })]))
      expect(svg).toContain('fill="blue"')
    })

    it('renders unfilled path with fill=none', () => {
      const svg = engine.draw(makeSheet([pathEl({ fill: false })]))
      expect(svg).toContain('fill="none"')
    })

    it('returns empty for empty path array', () => {
      const svg = engine.draw(makeSheet([pathEl({ path: [] })]))
      // No path element beyond the border
      expect(svg).not.toContain('stroke-linecap')
    })
  })

  describe('Annotation', () => {
    it('renders a text element', () => {
      const svg = engine.draw(makeSheet([annotation()]))
      expect(svg).toContain('<text ')
      expect(svg).toContain('Hello')
      expect(svg).toContain('x="20"')
      expect(svg).toContain('y="30"')
      expect(svg).toContain('pointer-events="none"')
    })

    it('escapes special characters in text', () => {
      const svg = engine.draw(makeSheet([annotation({ text: '<b>&"test"</b>' })]))
      expect(svg).toContain('&lt;b&gt;&amp;&quot;test&quot;&lt;/b&gt;')
      expect(svg).not.toContain('<b>')
    })

    it('renders multi-line text with tspan elements', () => {
      const svg = engine.draw(makeSheet([annotation({ text: 'Line1\nLine2' })]))
      expect(svg).toContain('<tspan')
      expect(svg).toContain('Line1')
      expect(svg).toContain('Line2')
    })

    it('uses font size from style', () => {
      const eng = new SvgEngine({
        width: 400,
        height: 282,
        fontStyles: { regular: { fontSize: 5, fontStyle: 'normal' } },
      })
      const svg = eng.draw(makeSheet([annotation({ style: 'regular' })]))
      expect(svg).toContain('font-size="5"')
    })

    it('makes configured annotations draggable in interactive output', () => {
      const interactive = new SvgEngine({ width: 400, height: 282, interactive: true })
      const svg = interactive.draw(makeSheet([annotation({
        confKey: 'extract.0.notebound.tuplet.v_1.42.*',
        draginfo: {
          handler: 'annotation',
          conf_key: 'extract.0.notebound.tuplet.v_1.42',
          value: [3, -2],
        },
      })]))

      expect(svg).toContain('data-drag-handler="annotation"')
      expect(svg).toContain('data-drag-conf-key="extract.0.notebound.tuplet.v_1.42"')
      expect(svg).toContain('data-drag-value="[3,-2]"')
    })
  })

  describe('Image', () => {
    it('renders the configured position as the image top edge', () => {
      const svg = engine.draw(makeSheet([image()]))
      expect(svg).toContain('<image ')
      expect(svg).toContain('href="https://example.com/harp.png"')
      expect(svg).toContain('x="10" y="50"')
      expect(svg).toContain('height="30"')
    })

    it('escapes URL in href', () => {
      const svg = engine.draw(makeSheet([image({ url: 'https://example.com/a&b.png' })]))
      expect(svg).toContain('href="https://example.com/a&amp;b.png"')
    })

    it('renders resize handles with separate position and height metadata', () => {
      const interactive = new SvgEngine({ width: 400, height: 282, interactive: true })
      const svg = interactive.draw(makeSheet([image({
        confKey: 'extract.0.images.0.pos',
        draginfo: {
          handler: 'annotation',
          conf_key: 'extract.0.images.0.pos',
          height_conf_key: 'extract.0.images.0.height',
          height: 30,
        },
      })]))

      expect(svg).toContain('data-drag-conf-key="extract.0.images.0.pos"')
      expect(svg).toContain('data-drag-height-conf-key="extract.0.images.0.height"')
      expect(svg).toContain('data-drag-height-value="30"')
      expect(svg.match(/data-image-resize-corner=/g)).toHaveLength(4)
    })
  })

  describe('full pipeline integration', () => {
    it('renders a sheet with mixed elements without throwing', () => {
      const sheet = makeSheet([
        filledEllipse(),
        emptyEllipse({ center: [60, 100] }),
        flowLine(),
        glyph({ center: [70, 100] }),
        annotation(),
        pathEl(),
      ])
      expect(() => engine.draw(sheet)).not.toThrow()
    })

    it('snapshot: single filled note', () => {
      const svg = engine.draw(makeSheet([filledEllipse()]))
      expect(svg).toMatchSnapshot()
    })

    it('snapshot: glyph rest_4', () => {
      const svg = engine.draw(makeSheet([glyph()]))
      expect(svg).toMatchSnapshot()
    })
  })
})
