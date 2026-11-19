import { swatchNumber } from '../config/palettes.ts'
import { GRID_SIZE } from '../types/tileprint.ts'
import type { TileColorMap, TileColors, TileOrigin } from '../types/tileprint.ts'

export type TileKind = 'small' | 'large'

export interface AssemblyTile {
  kind: TileKind
  row: number
  col: number
  hex: string
  swatch: number | null
}

export function tileColorKey(kind: TileKind, origin: TileOrigin): string {
  return `${kind === 'large' ? 'l' : 's'}:${origin.row},${origin.col}`
}

export function tileHex(
  paints: TileColorMap,
  kind: TileKind,
  origin: TileOrigin,
  defaults: TileColors,
): string {
  return paints[tileColorKey(kind, origin)] ?? (kind === 'large' ? defaults.large : defaults.small)
}

export function paintTile(
  paints: TileColorMap,
  kind: TileKind,
  origin: TileOrigin,
  hex: string,
): TileColorMap {
  return { ...paints, [tileColorKey(kind, origin)]: hex }
}

function cellsOf(origin: TileOrigin): TileOrigin[] {
  return [
    { row: origin.row, col: origin.col },
    { row: origin.row, col: origin.col + 1 },
    { row: origin.row + 1, col: origin.col },
    { row: origin.row + 1, col: origin.col + 1 },
  ]
}

/** The four new small tiles keep the large tile's color. The large-tile color stays for a later reset. */
export function colorsAfterSplit(
  origin: TileOrigin,
  paints: TileColorMap,
  defaults: TileColors,
): TileColorMap {
  const hex = tileHex(paints, 'large', origin, defaults)
  const next = { ...paints }
  for (const cell of cellsOf(origin)) next[tileColorKey('small', cell)] = hex
  return next
}

/** The new large tile takes the color of its top-left cell. */
export function colorsAfterMerge(
  origin: TileOrigin,
  paints: TileColorMap,
  defaults: TileColors,
): TileColorMap {
  const hex = tileHex(paints, 'small', origin, defaults)
  const next = { ...paints, [tileColorKey('large', origin)]: hex }
  for (const cell of cellsOf(origin)) delete next[tileColorKey('small', cell)]
  return next
}

export interface PhysicalTile {
  kind: TileKind
  origin: TileOrigin
}

/** One entry per physical piece, in stored coordinates. A 2×2 is a single entry. */
export function physicalTiles(tiles: readonly TileOrigin[]): PhysicalTile[] {
  const covered = new Set<string>()
  const pieces: PhysicalTile[] = []

  for (const origin of tiles) {
    for (const cell of cellsOf(origin)) covered.add(`${cell.row},${cell.col}`)
    pieces.push({ kind: 'large', origin })
  }

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (covered.has(`${row},${col}`)) continue
      pieces.push({ kind: 'small', origin: { row, col } })
    }
  }

  return pieces
}

/** Every physical tile in stored coordinates, with its swatch number when the hex is in the palette. */
export function assemblyTiles(
  tiles: readonly TileOrigin[],
  colors: TileColors,
  paints: TileColorMap,
  paletteId: string,
): AssemblyTile[] {
  return physicalTiles(tiles).map((piece) => {
    const hex = tileHex(paints, piece.kind, piece.origin, colors)
    return {
      kind: piece.kind,
      row: piece.origin.row,
      col: piece.origin.col,
      hex,
      swatch: swatchNumber(paletteId, hex),
    }
  })
}
