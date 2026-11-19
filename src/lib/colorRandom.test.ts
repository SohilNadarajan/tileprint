import { describe, expect, it } from 'vitest'
import { swatchHexes } from '../config/palettes.ts'
import { generateFingerprint } from './fingerprint.ts'
import { randomAssignment, uniformAssignment, type RandomInt } from './colorRandom.ts'
import { physicalTiles } from './tileColors.ts'

const tiles = [
  { row: 0, col: 0 },
  { row: 0, col: 3 },
  { row: 4, col: 4 },
  { row: 6, col: 1 },
]

function counting(sequence: number[]): RandomInt {
  let index = 0
  return (bound) => {
    const value = sequence[index] ?? 0
    index += 1
    return ((value % bound) + bound) % bound
  }
}

function counts(paints: Record<string, string>): Map<string, number> {
  const tally = new Map<string, number>()
  for (const hex of Object.values(paints)) tally.set(hex, (tally.get(hex) ?? 0) + 1)
  return tally
}

describe('color randomization', () => {
  it('assigns one random swatch from the selected palette to each physical tile', () => {
    const pieces = physicalTiles(tiles)
    const hexes = swatchHexes(['tant-blue'])
    const paints = randomAssignment(pieces, hexes, counting([0, 3, 11, 3]))
    expect(Object.keys(paints)).toHaveLength(pieces.length)
    expect(new Set(Object.values(paints)).size).toBeGreaterThan(1)
    for (const hex of Object.values(paints)) expect(hexes).toContain(hex)
    expect(paints['l:0,0']).toBe('#027EBF')
    expect(paints['l:0,3']).toBe('#122F7A')
  })

  it('spreads one palette so swatch counts differ by at most one', () => {
    const pieces = physicalTiles(tiles)
    const hexes = swatchHexes(['tant-green'])
    const paints = uniformAssignment(pieces, hexes, counting([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    const tally = counts(paints)
    expect([...tally.values()].reduce((sum, count) => sum + count, 0)).toBe(pieces.length)
    const used = [...tally.values()]
    expect(Math.max(...used) - Math.min(...used)).toBeLessThanOrEqual(1)
    expect(tally.size).toBe(Math.min(hexes.length, pieces.length))
    for (const hex of tally.keys()) expect(hexes).toContain(hex)
  })

  it('draws across the checked TANT families and leaves the tiles untouched', async () => {
    const source = tiles.map((tile) => ({ ...tile }))
    const pieces = physicalTiles(source)
    const hexes = swatchHexes(['tant-blue', 'tant-red'])
    const paints = randomAssignment(pieces, hexes, counting([0, 12, 23]))
    expect(source).toEqual(tiles)
    expect(paints['l:0,0']).toBe('#027EBF')
    expect(paints['l:0,3']).toBe('#F23102')
    expect(hexes).toHaveLength(24)
    expect(randomAssignment(pieces, [], counting([]))).toEqual({})

    const pattern = await generateFingerprint('NARA')
    expect(pattern?.patternId).toBe('TP-7E90C160')
    expect(pattern?.serialization).toBe('00030635506366')
  })
})
