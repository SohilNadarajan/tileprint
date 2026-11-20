import { describe, expect, it } from 'vitest'
import { changePalette, getPalette, PALETTES, swatchNumber } from '../config/palettes.ts'
import { DEFAULT_DISPLAY, GRID_SIZE } from '../types/tileprint.ts'
import type { DisplayRotation, TileOrigin } from '../types/tileprint.ts'
import { buildExportDocument, buildSvgString } from './export.ts'
import { generateFingerprint } from './fingerprint.ts'
import { serializeTiles } from './geometry.ts'
import { composeArtwork, type ArtworkScene, type DrawCommand } from './render.ts'

const FAMILIES = {
  'tant-blue': [
    '#027EBF',
    '#008BB7',
    '#09689A',
    '#122F7A',
    '#474C90',
    '#074E85',
    '#1E4886',
    '#319FCF',
    '#8B8DC3',
    '#3CA0BC',
    '#35B1D8',
    '#AAD7E9',
  ],
  'tant-yellow': [
    '#FFC901',
    '#FEBB02',
    '#FD9301',
    '#F37804',
    '#F96102',
    '#FA4E02',
    '#DC7805',
    '#FFD900',
    '#FDD201',
    '#FEE401',
    '#FAE374',
    '#F8E58B',
  ],
  'tant-green': [
    '#2D973E',
    '#1C6A2D',
    '#336C1D',
    '#567B1C',
    '#5AAE39',
    '#87BE47',
    '#8DC047',
    '#C7D43E',
    '#9DCB83',
    '#C0D5AC',
    '#D1DB97',
    '#DCE0AE',
  ],
  'tant-red': [
    '#F23102',
    '#A92A05',
    '#83160C',
    '#4E1913',
    '#F44903',
    '#82132C',
    '#B8124B',
    '#E49599',
    '#F3C5C9',
    '#C88388',
    '#EBB2A0',
    '#F4D0B7',
  ],
} as const

const tiles: TileOrigin[] = [
  { row: 0, col: 0 },
  { row: 0, col: 3 },
  { row: 4, col: 4 },
  { row: 6, col: 1 },
]

function sceneFor(rotation: DisplayRotation, paints: Record<string, string>, showNumbers: boolean): ArtworkScene {
  const palette = getPalette('tant-blue')
  if (!palette) throw new Error('missing TANT Blue')
  return composeArtwork({
    tiles,
    colors: palette.colors,
    display: { ...DEFAULT_DISPLAY, rotation, showNumbers, frame: false },
    includeHints: false,
    paints,
    paletteId: 'tant-blue',
    swatches: palette.swatches,
  })
}

function texts(scene: ArtworkScene): Array<Extract<DrawCommand, { type: 'text' }>> {
  return scene.commands.filter((command) => command.type === 'text')
}

function numberAt(scene: ArtworkScene, kind: 'small' | 'large', origin: TileOrigin) {
  const placed = kind === 'large' ? scene.largeTiles : scene.smallTiles
  const index = placed.findIndex(
    (tile) => tile.origin?.row === origin.row && tile.origin.col === origin.col,
  )
  return texts(scene).find((command) => command.id === `number-${kind}-${index}`)
}

describe('TANT palettes', () => {
  it('keeps twelve stable swatches in packaging order', () => {
    for (const [id, hexes] of Object.entries(FAMILIES)) {
      const palette = getPalette(id)
      expect(palette?.swatches).toHaveLength(12)
      expect(palette?.swatches?.map((swatch) => swatch.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      expect(palette?.swatches?.map((swatch) => swatch.hex)).toEqual([...hexes])
      hexes.forEach((hex, index) => {
        expect(swatchNumber(id, hex)).toBe(index + 1)
        expect(swatchNumber(id, hex.toLowerCase())).toBe(index + 1)
      })
    }

    for (const palette of PALETTES) {
      if (palette.id.startsWith('tant-')) continue
      expect(palette.swatches).toBeUndefined()
    }
  })

  it('shows the swatch number of the color on that tile', () => {
    const paints = { 'l:0,0': '#122F7A', 's:7,7': '#AAD7E9', 's:2,2': '#010203' }
    const scene = sceneFor(0, paints, true)
    expect(numberAt(scene, 'large', { row: 0, col: 0 })?.text).toBe('4')
    expect(numberAt(scene, 'small', { row: 7, col: 7 })?.text).toBe('12')
    expect(numberAt(scene, 'small', { row: 2, col: 2 })).toBeUndefined()
    expect(numberAt(scene, 'large', { row: 4, col: 4 })?.text).toBe('1')
    expect(texts(scene)).toHaveLength(GRID_SIZE * GRID_SIZE - tiles.length * 3 - 1)
  })

  it('draws one centered number on each physical tile, including after rotation', () => {
    const paints = { 'l:0,0': '#122F7A' }
    const rotations: DisplayRotation[] = [0, 90, 180, 270]
    const positions = rotations.map((rotation) => {
      const scene = sceneFor(rotation, paints, true)
      const physical = GRID_SIZE * GRID_SIZE - tiles.length * 3
      expect(texts(scene)).toHaveLength(physical)
      expect(texts(scene).filter((command) => command.id.startsWith('number-large-'))).toHaveLength(tiles.length)

      for (const tile of scene.largeTiles) {
        const inside = texts(scene).filter(
          (command) =>
            command.x >= tile.x &&
            command.x <= tile.x + tile.w &&
            command.y >= tile.y &&
            command.y <= tile.y + tile.h,
        )
        expect(inside).toHaveLength(1)
      }

      for (const command of texts(scene)) {
        const match = /^number-(small|large)-(\d+)$/.exec(command.id)
        expect(match).not.toBeNull()
        if (!match) continue
        const placed = match[1] === 'large' ? scene.largeTiles : scene.smallTiles
        const tile = placed[Number(match[2])]
        expect(tile).toBeDefined()
        if (!tile) continue
        expect(command.x).toBe(Math.round((tile.x + tile.w / 2) * 100) / 100)
        expect(command.y).toBe(Math.round((tile.y + tile.h / 2) * 100) / 100)
      }

      const labeled = numberAt(scene, 'large', { row: 0, col: 0 })
      expect(labeled?.text).toBe('4')
      return `${labeled?.x},${labeled?.y}`
    })

    expect(new Set(positions).size).toBe(4)
  })

  it('adds a 45 degree view tilt without changing the tile grid', () => {
    const straight = sceneFor(0, {}, false)
    const tilted = sceneFor(45, { 'l:0,0': '#122F7A' }, true)
    const turned = sceneFor(135, {}, false)
    expect(straight.tilt.degrees).toBe(0)
    expect(tilted.tilt.degrees).toBe(45)
    expect(turned.tilt.degrees).toBe(45)
    expect(tilted.tilt.scale).toBeCloseTo(1 / Math.SQRT2, 4)
    expect(tilted.largeTiles.map((tile) => tile.origin)).toEqual(straight.largeTiles.map((tile) => tile.origin))
    expect(tilted.largeTiles.map((tile) => [tile.visualRow, tile.visualCol])).toEqual(
      straight.largeTiles.map((tile) => [tile.visualRow, tile.visualCol]),
    )
    expect(turned.largeTiles.map((tile) => [tile.visualRow, tile.visualCol])).not.toEqual(
      straight.largeTiles.map((tile) => [tile.visualRow, tile.visualCol]),
    )
    expect(numberAt(tilted, 'large', { row: 0, col: 0 })?.text).toBe('4')
    expect(serializeTiles(tiles)).toBe('00034461')
  })

  it('leaves geometry and the fingerprint unchanged when numbers or colors change', async () => {
    const before = serializeTiles(tiles)
    const hidden = sceneFor(90, { 'l:0,0': '#122F7A' }, false)
    const shown = sceneFor(90, { 'l:0,0': '#AAD7E9' }, true)
    expect(serializeTiles(tiles)).toBe(before)
    expect(hidden.largeTiles.map((tile) => tile.origin)).toEqual(shown.largeTiles.map((tile) => tile.origin))
    expect(texts(hidden)).toHaveLength(0)
    expect(texts(shown).length).toBeGreaterThan(0)

    const pattern = await generateFingerprint('NARA')
    const palette = getPalette('tant-blue')
    expect(pattern?.patternId).toBe('TP-7E90C160')
    if (!pattern || !palette) return
    const shared = {
      originalText: pattern.originalText,
      normalizedText: pattern.normalizedText,
      sha256: pattern.sha256,
      canonicalTiles: pattern.largeTiles,
      displayTiles: pattern.largeTiles,
      colors: palette.colors,
      paletteId: 'tant-blue',
    }
    const painted = buildExportDocument({
      ...shared,
      tileColors: { 'l:0,0': '#122F7A' },
      display: { ...DEFAULT_DISPLAY, showNumbers: true },
    })
    expect(painted.encodingVersion).toBe('v3')
    expect(painted.canonical.identifier).toBe('TP-7E90C160')
    expect(painted.canonical.serialization).toBe(pattern.serialization)
    expect(painted.sha256).toBe(pattern.sha256)
    expect(painted.paletteId).toBe('tant-blue')
    expect(painted.tileColors).toEqual({ 'l:0,0': '#122F7A' })
    expect(painted.assembly.find((tile) => tile.kind === 'large' && tile.row === 0 && tile.col === 0)).toMatchObject({
      hex: '#122F7A',
      swatch: 4,
    })
    const custom = buildExportDocument({
      ...shared,
      tileColors: { 's:2,2': '#010203' },
      display: DEFAULT_DISPLAY,
    })
    expect(custom.canonical.identifier).toBe(pattern.patternId)
    expect(custom.assembly.find((tile) => tile.row === 2 && tile.col === 2 && tile.kind === 'small')).toMatchObject({
      hex: '#010203',
      swatch: null,
    })
  })

  it('includes numbers in the SVG drawn for PNG only while the toggle is on', () => {
    const palette = getPalette('tant-blue')
    if (!palette) throw new Error('missing TANT Blue')
    const shared = {
      tiles,
      colors: palette.colors,
      paints: { 'l:0,0': '#122F7A', 's:7,7': '#AAD7E9' },
      paletteId: 'tant-blue',
    }
    const numbered = buildSvgString({
      ...shared,
      display: { ...DEFAULT_DISPLAY, showNumbers: true, frame: false },
    })
    const clean = buildSvgString({
      ...shared,
      display: { ...DEFAULT_DISPLAY, showNumbers: false, frame: false },
    })
    expect(numbered).toContain('>4</text>')
    expect(numbered).toContain('>12</text>')
    expect(numbered).toContain('pointer-events="none"')
    expect(clean).not.toContain('<text')
  })

  it('remaps a TANT family by swatch number and keeps an unknown hex custom', () => {
    const blue = getPalette('tant-blue')
    if (!blue) throw new Error('missing TANT Blue')
    const next = changePalette('tant-blue', 'tant-yellow', blue.colors, {
      'l:0,0': '#122F7A',
      's:2,2': '#ABCDEF',
    })
    expect(next.paletteId).toBe('tant-yellow')
    expect(next.colors.large).toBe('#FFC901')
    expect(next.colors.small).toBe('#F8E58B')
    expect(next.paints['l:0,0']).toBe('#F37804')
    expect(swatchNumber('tant-yellow', next.paints['l:0,0'] ?? '')).toBe(4)
    expect(next.paints['s:2,2']).toBe('#ABCDEF')
    expect(swatchNumber('tant-yellow', '#ABCDEF')).toBeNull()

    const classic = changePalette('tant-yellow', 'warm-neutral', next.colors, next.paints)
    expect(classic.paletteId).toBe('warm-neutral')
    expect(classic.paints).toEqual({})
    expect(classic.colors).toEqual(getPalette('warm-neutral')?.colors)
  })
})
