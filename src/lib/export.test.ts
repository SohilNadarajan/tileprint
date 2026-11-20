import { describe, expect, it } from 'vitest'
import { DEFAULT_DISPLAY } from '../types/tileprint.ts'
import { generateFingerprint } from './fingerprint.ts'
import {
  artworkFilename,
  buildExportDocument,
  buildSvgString,
  serializeExportJson,
} from './export.ts'
import { splitLargeTile } from './geometry.ts'
import { composeArtwork, gridMetrics, hitTest } from './render.ts'

const colors = { small: '#111111', large: '#222222', background: '#ffffff' }
const otherColors = { small: '#abcdef', large: '#123456', background: '#fefefe' }

describe('export', () => {
  it('serializes canonical coordinates and colors without letting color change identity', async () => {
    const pattern = await generateFingerprint('NARA')
    expect(pattern).not.toBeNull()
    if (!pattern) return
    const base = {
      originalText: pattern.originalText,
      normalizedText: pattern.normalizedText,
      sha256: pattern.sha256,
      canonicalTiles: pattern.largeTiles,
      displayTiles: pattern.largeTiles,
      paletteId: 'warm-neutral',
      display: DEFAULT_DISPLAY,
    }
    const neutral = buildExportDocument({ ...base, colors })
    const recolored = buildExportDocument({
      ...base,
      colors: otherColors,
      display: { ...DEFAULT_DISPLAY, rotation: 90 },
    })

    expect(neutral.encodingVersion).toBe('v3')
    expect(neutral.sha256).toBe(pattern.sha256)
    expect(neutral.canonical.serialization).toBe(pattern.serialization)
    expect(neutral.canonical.identifier).toBe(pattern.patternId)
    expect(neutral.canonical.largeTiles).toEqual(pattern.largeTiles)
    expect(neutral.displayed.isCanonical).toBe(true)
    expect(recolored.canonical).toEqual(neutral.canonical)
    expect(recolored.sha256).toBe(neutral.sha256)
    expect(recolored.colors).toEqual(otherColors)
    expect(recolored.displayed.rotation).toBe(90)

    const parsed = JSON.parse(serializeExportJson({ ...base, colors })) as typeof neutral
    expect(parsed).toEqual(neutral)
    expect(serializeExportJson({ ...base, colors }).endsWith('\n')).toBe(true)
  })

  it('keeps a creative sheet separate from the canonical pattern', async () => {
    const pattern = await generateFingerprint('NARA')
    expect(pattern).not.toBeNull()
    if (!pattern) return
    const origin = pattern.largeTiles[0]
    expect(origin).toBeDefined()
    if (!origin) return
    const edited = splitLargeTile(pattern.largeTiles, origin)
    const document = buildExportDocument({
      originalText: 'NARA',
      normalizedText: pattern.normalizedText,
      sha256: pattern.sha256,
      canonicalTiles: pattern.largeTiles,
      displayTiles: edited,
      colors,
      paletteId: 'custom',
      display: DEFAULT_DISPLAY,
    })

    expect(document.displayed.isCanonical).toBe(false)
    expect(document.displayed.largeTiles).toEqual(edited)
    expect(document.canonical.serialization).toBe(pattern.serialization)
    expect(document.canonical.identifier).toBe(pattern.patternId)
  })

  it('draws a 2×2 tile across exactly four cells and omits creative marks', () => {
    const display = { ...DEFAULT_DISPLAY, frame: false, gap: 10, outlines: false, rotation: 0 as const }
    const metrics = gridMetrics(display)
    const scene = composeArtwork({
      tiles: [{ row: 0, col: 0 }],
      colors,
      display,
      includeHints: false,
    })
    const large = scene.commands.find((command) => command.type === 'rect' && command.kind === 'large')
    const smallX = metrics.contentOrigin + 2 * metrics.pitch
    const small = scene.commands.find(
      (command) =>
        command.type === 'rect' &&
        command.kind === 'small' &&
        Math.abs(command.x - smallX) < 0.02 &&
        Math.abs(command.y - metrics.contentOrigin) < 0.02,
    )

    expect(large?.type).toBe('rect')
    expect(small?.type).toBe('rect')
    if (large?.type !== 'rect' || small?.type !== 'rect') return
    expect(large.w).toBeCloseTo(2 * metrics.cell + metrics.gap, 2)
    expect(large.h).toBe(large.w)
    expect(small.w).toBeCloseTo(metrics.cell, 2)
    expect(large.x + large.w + metrics.gap).toBeCloseTo(small.x, 1)
    expect(scene.commands.filter((command) => command.type === 'rect' && command.kind === 'small')).toHaveLength(60)
    expect(scene.largeTiles[0]).toMatchObject({ visualRow: 0, visualCol: 0 })

    const svg = buildSvgString({
      tiles: [{ row: 0, col: 0 }],
      colors,
      display,
      title: 'KYOTO & co',
    })
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(svg).toContain('fill="#222222"')
    expect(svg).toContain('fill="#111111"')
    expect(svg).toContain('<title>KYOTO &amp; co</title>')
    expect(svg).not.toContain('<circle')

    const turned = composeArtwork({
      tiles: [{ row: 0, col: 0 }],
      colors,
      display: { ...display, rotation: 90 },
      includeHints: false,
    })
    expect(turned.largeTiles[0]).toMatchObject({ visualRow: 0, visualCol: 6 })
  })

  it('rotates the frame with a 45 degree view', () => {
    const svg = buildSvgString({
      tiles: [{ row: 0, col: 0 }],
      colors,
      display: { ...DEFAULT_DISPLAY, rotation: 45 },
    })
    const group = svg.indexOf('<g transform="translate(500 500) rotate(45) scale(0.7071) translate(-500 -500)">')
    const frame = svg.indexOf('fill="#3a332d"')
    expect(group).toBeGreaterThan(-1)
    expect(frame).toBeGreaterThan(group)
    expect(svg.indexOf('</g>')).toBeGreaterThan(frame)
  })

  it('hits large tiles before overlapping merge regions', () => {
    const display = { ...DEFAULT_DISPLAY, frame: false, gap: 8, rotation: 0 as const }
    const scene = composeArtwork({
      tiles: [{ row: 0, col: 0 }],
      colors,
      display,
      includeHints: true,
    })
    const large = scene.largeTiles[0]
    expect(large).toBeDefined()
    if (!large) return
    expect(hitTest(scene, large.x + 4, large.y + 4)).toEqual({
      kind: 'split',
      origin: { row: 0, col: 0 },
    })

    const hint = scene.hints.find((candidate) => candidate.origin?.row === 0 && candidate.origin.col === 2)
    expect(hint).toBeDefined()
    if (!hint) return
    expect(hitTest(scene, hint.x + hint.w / 2, hint.y + hint.h / 2)).toEqual({
      kind: 'merge',
      origin: { row: 0, col: 2 },
    })
  })

  it('builds safe filenames', () => {
    expect(artworkFilename('kyoto', 'TP-97F18D52', 'svg')).toBe('tileprint-kyoto-TP-97F18D52.svg')
    expect(artworkFilename('new york', 'TP-AAAAAAAA', 'png')).toBe(
      'tileprint-new-york-TP-AAAAAAAA.png',
    )
    expect(artworkFilename('   ', 'TP-AAAAAAAA', 'json')).toBe('tileprint-untitled-TP-AAAAAAAA.json')
  })
})
