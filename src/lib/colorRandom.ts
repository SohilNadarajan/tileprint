import type { TileColorMap } from '../types/tileprint.ts'
import { tileColorKey, type PhysicalTile } from './tileColors.ts'

/** Returns an integer in `0 .. bound - 1`. */
export type RandomInt = (bound: number) => number

/** A fresh integer for exploratory coloring. Independent of the fingerprint generator. */
export function randomInt(bound: number): number {
  if (bound <= 1) return 0
  const max = 0x100000000
  const limit = max - (max % bound)
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0] ?? 0
  } while (value >= limit)
  return value % bound
}

export function shuffle<T>(items: readonly T[], nextInt: RandomInt): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = nextInt(index + 1)
    const current = next[index]
    const other = next[swap]
    if (current === undefined || other === undefined) continue
    next[index] = other
    next[swap] = current
  }
  return next
}

function assign(pieces: readonly PhysicalTile[], hexes: readonly string[]): TileColorMap {
  const paints: TileColorMap = {}
  pieces.forEach((piece, index) => {
    const hex = hexes[index]
    if (!hex) return
    paints[tileColorKey(piece.kind, piece.origin)] = hex
  })
  return paints
}

/** Each physical tile draws one swatch independently. */
export function randomAssignment(
  pieces: readonly PhysicalTile[],
  hexes: readonly string[],
  nextInt: RandomInt,
): TileColorMap {
  if (hexes.length === 0) return {}
  return assign(
    pieces,
    pieces.map(() => hexes[nextInt(hexes.length)] ?? ''),
  )
}

/**
 * Deals the swatches so their counts differ by at most one, then shuffles
 * those deals across the physical tiles.
 */
export function uniformAssignment(
  pieces: readonly PhysicalTile[],
  hexes: readonly string[],
  nextInt: RandomInt,
): TileColorMap {
  if (pieces.length === 0 || hexes.length === 0) return {}
  const order = shuffle(hexes, nextInt)
  const base = Math.floor(pieces.length / order.length)
  const extra = pieces.length % order.length
  const bag: string[] = []
  order.forEach((hex, index) => {
    const count = base + (index < extra ? 1 : 0)
    for (let copy = 0; copy < count; copy += 1) bag.push(hex)
  })
  return assign(pieces, shuffle(bag, nextInt))
}
