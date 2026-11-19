import { GRID_SIZE } from '../types/tileprint.ts'
import type { Rotation, TileOrigin } from '../types/tileprint.ts'

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270]

export function compareOrigins(a: TileOrigin, b: TileOrigin): number {
  return a.row - b.row || a.col - b.col
}

export function sortOrigins(tiles: readonly TileOrigin[]): TileOrigin[] {
  return tiles.map((tile) => ({ row: tile.row, col: tile.col })).sort(compareOrigins)
}

export function cloneTiles(tiles: readonly TileOrigin[]): TileOrigin[] {
  return tiles.map((tile) => ({ row: tile.row, col: tile.col }))
}

/** Inverse of `rotateCell` for the same clockwise angle. */
export function unrotateCell(
  row: number,
  col: number,
  rotation: Rotation,
  size = GRID_SIZE,
): TileOrigin {
  switch (rotation) {
    case 0:
      return { row, col }
    case 90:
      return rotateCell(row, col, 270, size)
    case 180:
      return rotateCell(row, col, 180, size)
    case 270:
      return rotateCell(row, col, 90, size)
  }
}

export function rotateCell(
  row: number,
  col: number,
  rotation: Rotation,
  size = GRID_SIZE,
): TileOrigin {
  switch (rotation) {
    case 0:
      return { row, col }
    case 90:
      return { row: col, col: size - 1 - row }
    case 180:
      return { row: size - 1 - row, col: size - 1 - col }
    case 270:
      return { row: size - 1 - col, col: row }
  }
}

/** Rotate a 2×2 origin clockwise. The result is the new top-left cell. */
export function rotateOrigin(
  origin: TileOrigin,
  rotation: Rotation,
  size = GRID_SIZE,
): TileOrigin {
  const cells = [
    rotateCell(origin.row, origin.col, rotation, size),
    rotateCell(origin.row, origin.col + 1, rotation, size),
    rotateCell(origin.row + 1, origin.col, rotation, size),
    rotateCell(origin.row + 1, origin.col + 1, rotation, size),
  ]
  return {
    row: Math.min(...cells.map((cell) => cell.row)),
    col: Math.min(...cells.map((cell) => cell.col)),
  }
}

export function rotateTiles(tiles: readonly TileOrigin[], rotation: Rotation): TileOrigin[] {
  return sortOrigins(tiles.map((tile) => rotateOrigin(tile, rotation)))
}

/**
 * Canonical serialization: origins sorted by row, then column.
 * Each coordinate is one decimal digit, so a tile is two characters.
 * (0,2) then (4,1) serializes as "0241".
 */
export function serializeTiles(tiles: readonly TileOrigin[]): string {
  return sortOrigins(tiles)
    .map((tile) => `${tile.row}${tile.col}`)
    .join('')
}

export function parseSerialization(serialization: string): TileOrigin[] {
  if (serialization.length % 2 !== 0 || /[^0-9]/.test(serialization)) {
    throw new Error('Invalid tile serialization')
  }

  const tiles: TileOrigin[] = []
  for (let index = 0; index < serialization.length; index += 2) {
    tiles.push({
      row: Number(serialization[index]),
      col: Number(serialization[index + 1]),
    })
  }
  return tiles
}

export function canonicalSerialization(tiles: readonly TileOrigin[]): string {
  let best = serializeTiles(tiles)
  for (const rotation of ROTATIONS) {
    const serial = serializeTiles(rotateTiles(tiles, rotation))
    if (serial < best) best = serial
  }
  return best
}

/**
 * Choose the clockwise rotation whose serialization is lexicographically
 * smallest. Equal serializations keep the smaller angle, because a candidate
 * replaces the current one only when its string is strictly smaller.
 */
export function canonicalizeTiles(tiles: readonly TileOrigin[]): TileOrigin[] {
  let bestTiles = sortOrigins(tiles)
  let best = serializeTiles(bestTiles)

  for (const rotation of [90, 180, 270] as const) {
    const rotated = rotateTiles(tiles, rotation)
    const serial = serializeTiles(rotated)
    if (serial < best) {
      best = serial
      bestTiles = rotated
    }
  }

  return bestTiles
}

export function chebyshev(a: TileOrigin, b: TileOrigin): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col))
}

/** 2×2 tiles overlap exactly when their origins are less than 2 cells apart. */
export function tilesOverlap(a: TileOrigin, b: TileOrigin): boolean {
  return chebyshev(a, b) < 2
}

export function isValidLargeOrigin(origin: TileOrigin, size = GRID_SIZE): boolean {
  return (
    Number.isInteger(origin.row) &&
    Number.isInteger(origin.col) &&
    origin.row >= 0 &&
    origin.col >= 0 &&
    origin.row <= size - 2 &&
    origin.col <= size - 2
  )
}

export interface CoverageReport {
  ok: boolean
  largeCount: number
  smallCount: number
  errors: string[]
}

export function validateCoverage(tiles: readonly TileOrigin[], size = GRID_SIZE): CoverageReport {
  const errors: string[] = []
  const seen = new Set<string>()

  tiles.forEach((tile, index) => {
    if (!isValidLargeOrigin(tile, size)) {
      errors.push(`Tile ${index} at (${tile.row},${tile.col}) does not fit`)
      return
    }

    for (let row = tile.row; row < tile.row + 2; row += 1) {
      for (let col = tile.col; col < tile.col + 2; col += 1) {
        const key = `${row},${col}`
        if (seen.has(key)) errors.push(`Overlap at ${key}`)
        seen.add(key)
      }
    }
  })

  const largeCells = tiles.length * 4
  return {
    ok: errors.length === 0,
    largeCount: tiles.length,
    smallCount: size * size - (errors.length === 0 ? largeCells : seen.size),
    errors,
  }
}

export function canPlace(tiles: readonly TileOrigin[], origin: TileOrigin): boolean {
  if (!isValidLargeOrigin(origin)) return false
  return tiles.every((tile) => !tilesOverlap(tile, origin))
}

export function mergeCandidates(tiles: readonly TileOrigin[]): TileOrigin[] {
  const candidates: TileOrigin[] = []
  for (let row = 0; row <= GRID_SIZE - 2; row += 1) {
    for (let col = 0; col <= GRID_SIZE - 2; col += 1) {
      const origin = { row, col }
      if (canPlace(tiles, origin)) candidates.push(origin)
    }
  }
  return candidates
}

export function splitLargeTile(tiles: readonly TileOrigin[], origin: TileOrigin): TileOrigin[] {
  return sortOrigins(
    tiles.filter((tile) => tile.row !== origin.row || tile.col !== origin.col),
  )
}

export function mergeLargeTile(
  tiles: readonly TileOrigin[],
  origin: TileOrigin,
): TileOrigin[] | null {
  if (!canPlace(tiles, origin)) return null
  return sortOrigins([...tiles, origin])
}

export function sameTiles(a: readonly TileOrigin[], b: readonly TileOrigin[]): boolean {
  return serializeTiles(a) === serializeTiles(b)
}

export function smallTileCount(largeCount: number, size = GRID_SIZE): number {
  return size * size - largeCount * 4
}
