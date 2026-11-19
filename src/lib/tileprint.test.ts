import { describe, expect, it } from 'vitest'
import type { Rotation, TileOrigin } from '../types/tileprint.ts'
import {
  compareFingerprint,
  generateFingerprint,
  hashPayload,
  normalizeMessage,
  patternIdFromSerialization,
  sameArrangement,
  toHex,
} from './fingerprint.ts'
import { rotateTiles, serializeTiles, splitLargeTile, validateCoverage } from './geometry.ts'
import { createPrng } from './prng.ts'

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270]

const VECTORS = [
  {
    input: 'NARA',
    normalized: 'nara',
    sha256: '768c1c18e03c1f16682f971abe5086bdd9abc5458e9e22a04ba9403f4228e588',
    patternId: 'TP-7E90C160',
    serialization: '00030635506366',
    tiles: [
      { row: 0, col: 0 },
      { row: 0, col: 3 },
      { row: 0, col: 6 },
      { row: 3, col: 5 },
      { row: 5, col: 0 },
      { row: 6, col: 3 },
      { row: 6, col: 6 },
    ],
  },
  {
    input: 'Kyoto',
    normalized: 'kyoto',
    sha256: '13b26356f1094604c3cb69777b8381f1e8128b8de5bf994095b6c47dde080d09',
    patternId: 'TP-58007656',
    serialization: '00145166',
    tiles: [
      { row: 0, col: 0 },
      { row: 1, col: 4 },
      { row: 5, col: 1 },
      { row: 6, col: 6 },
    ],
  },
  {
    input: 'GOLDEN GATE BRIDGE',
    normalized: 'golden gate bridge',
    sha256: '2574bc58b6efc1a1d237e855bcb9f54655a88e2bf055990e69e15760f9bb2a8a',
    patternId: 'TP-35C1AB5A',
    serialization: '001316305662',
    tiles: [
      { row: 0, col: 0 },
      { row: 1, col: 3 },
      { row: 1, col: 6 },
      { row: 3, col: 0 },
      { row: 5, col: 6 },
      { row: 6, col: 2 },
    ],
  },
] as const

function expectBoard(tiles: readonly TileOrigin[]) {
  const coverage = validateCoverage(tiles)
  expect(coverage.ok).toBe(true)
  expect(tiles.length).toBeGreaterThanOrEqual(4)
  expect(tiles.length).toBeLessThanOrEqual(7)
  expect(coverage.smallCount).toBe(64 - tiles.length * 4)
  expect(coverage.smallCount + tiles.length * 4).toBe(64)
}

describe('xoshiro128**', () => {
  it('matches the specified uint32 sequence for seed 1, 2, 3, 4', () => {
    const rng = createPrng([1, 2, 3, 4])
    expect([rng.nextUint32(), rng.nextUint32(), rng.nextUint32(), rng.nextUint32()]).toEqual([
      11520, 0, 5927040, 70819200,
    ])
  })
})

describe('fingerprint', () => {
  it('normalizes NFC, trim, and lowercase without dropping interior punctuation', () => {
    expect(normalizeMessage('  Nara  ')).toBe('nara')
    expect(normalizeMessage('São Paulo')).toBe('são paulo')
    expect(normalizeMessage('e\u0301')).toBe(normalizeMessage('é'))
    expect(normalizeMessage("  O'Hara  ")).toBe("o'hara")
    expect(normalizeMessage('San Francisco')).not.toBe(normalizeMessage('san-francisco'))
  })

  it('hashes tileprint:v3:<normalized> with SHA-256', async () => {
    const payload = hashPayload('nara')
    expect(new TextDecoder().decode(payload)).toBe('tileprint:v3:nara')
    const digest = await crypto.subtle.digest('SHA-256', payload as BufferSource)
    expect(toHex(new Uint8Array(digest))).toBe(VECTORS[0].sha256)
  })

  it('repeats the same pattern for the same normalized message', async () => {
    const first = await generateFingerprint('NARA')
    const second = await generateFingerprint('  nara ')
    const third = await generateFingerprint('NARA')
    expect(first?.serialization).toBe(second?.serialization)
    expect(first?.sha256).toBe(second?.sha256)
    expect(first?.patternId).toBe(second?.patternId)
    expect(first?.largeTiles).toEqual(second?.largeTiles)
    expect(second?.originalText).toBe('  nara ')
    expect(third).toEqual(first)
  })

  it('locks the reference vectors', async () => {
    for (const vector of VECTORS) {
      const artwork = await generateFingerprint(vector.input)
      expect(artwork?.normalizedText).toBe(vector.normalized)
      expect(artwork?.sha256).toBe(vector.sha256)
      expect(artwork?.patternId).toBe(vector.patternId)
      expect(artwork?.serialization).toBe(vector.serialization)
      expect(artwork?.largeTiles).toEqual(vector.tiles)
      expect(patternIdFromSerialization(vector.serialization)).toBe(vector.patternId)
      expectBoard(vector.tiles)
    }
  })

  it('gives different representative messages different patterns', async () => {
    const messages = [
      'SOHIL',
      'BITHA',
      'CHARMANDER',
      'PIKACHU',
      'SAN FRANCISCO',
      'CHRISTOPHER',
      'HARRY POTTER',
      'GOLDEN GATE BRIDGE',
    ]
    const patterns = await Promise.all(messages.map((message) => generateFingerprint(message)))
    const serials = patterns.map((pattern) => pattern?.serialization)
    expect(new Set(serials).size).toBe(messages.length)
    for (const pattern of patterns) {
      expect(pattern).not.toBeNull()
      if (pattern) expectBoard(pattern.largeTiles)
    }
  })

  it('accepts a long title and uses every tile count from 4 to 7', async () => {
    const longTitle = `${'A'.repeat(240)} golden gate`
    const long = await generateFingerprint(longTitle)
    expect(long).not.toBeNull()
    if (long) expectBoard(long.largeTiles)

    const seen = new Set<number>()
    for (let index = 0; index < 48; index += 1) {
      const artwork = await generateFingerprint(`distribution ${index}`)
      expect(artwork).not.toBeNull()
      if (!artwork) continue
      expectBoard(artwork.largeTiles)
      seen.add(artwork.largeTiles.length)
    }
    expect([...seen].sort()).toEqual([4, 5, 6, 7])
  })

  it('matches a rotated sheet and rejects a different one', async () => {
    const artwork = await generateFingerprint('Kyoto')
    expect(artwork).not.toBeNull()
    if (!artwork) return

    for (const rotation of ROTATIONS) {
      const turned = rotateTiles(artwork.largeTiles, rotation)
      expect(sameArrangement(turned, artwork.serialization)).toBe(true)
      const comparison = await compareFingerprint('KYOTO', turned)
      expect(comparison.label).toBe('Match')
      expect(comparison.patternId).toBe(artwork.patternId)
    }

    const mismatch = await compareFingerprint('Kyoto', [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 0, col: 4 },
      { row: 0, col: 6 },
    ])
    expect(mismatch.label).toBe('No match')
    expect(mismatch.detail.toLowerCase()).toContain('cannot be reversed')
  })

  it('leaves the canonical fingerprint unchanged when the sheet is edited', async () => {
    const artwork = await generateFingerprint('NARA')
    expect(artwork).not.toBeNull()
    if (!artwork) return
    const origin = artwork.largeTiles[0]
    expect(origin).toBeDefined()
    if (!origin) return
    const edited = splitLargeTile(artwork.largeTiles, origin)
    expect(serializeTiles(edited)).not.toBe(artwork.serialization)
    expect(sameArrangement(edited, artwork.serialization)).toBe(false)
    const again = await generateFingerprint('nara')
    expect(again?.serialization).toBe(artwork.serialization)
    expect(again?.largeTiles).toEqual(artwork.largeTiles)
  })

  it('rejects a blank message', async () => {
    expect(await generateFingerprint('   ')).toBeNull()
    const comparison = await compareFingerprint('   ', [])
    expect(comparison.label).toBe('No match')
  })
})
