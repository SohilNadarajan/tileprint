export const GRID_SIZE = 8
export const MIN_LARGE_TILES = 4
export const MAX_LARGE_TILES = 7
export const ENCODING_VERSION = 'v3' as const

export interface TileOrigin {
  row: number
  col: number
}

export interface TileColors {
  small: string
  large: string
  background: string
}

/** Hex overrides keyed by `s:row,col` or `l:row,col` in stored coordinates. */
export type TileColorMap = Record<string, string>

export type Rotation = 0 | 90 | 180 | 270

/** View angle. Quarter turns stay on the grid; the odd steps tilt the sheet. */
export type DisplayRotation = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315

export const DISPLAY_ROTATIONS: readonly DisplayRotation[] = [0, 45, 90, 135, 180, 225, 270, 315]

export function quarterTurn(rotation: DisplayRotation): Rotation {
  return (Math.floor(rotation / 90) * 90) as Rotation
}

export interface DisplaySettings {
  rotation: DisplayRotation
  outlines: boolean
  outlineColor: string
  outlineWidth: number
  gap: number
  frame: boolean
  showNumbers: boolean
}

export interface SavedArtwork {
  id: string
  originalText: string
  normalizedText: string
  encodingVersion: typeof ENCODING_VERSION
  sha256: string
  canonicalTiles: TileOrigin[]
  canonicalSerialization: string
  patternId: string
  displayTiles: TileOrigin[]
  isCanonical: boolean
  paletteId: string
  colors: TileColors
  tileColors: TileColorMap
  display: DisplaySettings
  createdAt: string
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  rotation: 0,
  outlines: true,
  outlineColor: '#2a2622',
  outlineWidth: 1.5,
  gap: 8,
  frame: true,
  showNumbers: false,
}
