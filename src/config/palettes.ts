import type { TileColorMap, TileColors } from '../types/tileprint.ts'

export interface Swatch {
  number: number
  hex: string
}

export interface Palette {
  id: string
  name: string
  colors: TileColors
  /** Present for the 12-color TANT families. Number 1 is the first swatch. */
  swatches?: readonly Swatch[]
}

/** The sheet behind TANT papers. It is not one of the 12 numbered swatches. */
export const TANT_PAPER = '#f6f1e8'

const TANT_BLUE = [
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
] as const

const TANT_YELLOW = [
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
] as const

const TANT_GREEN = [
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
] as const

const TANT_RED = [
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
] as const

function tantPalette(id: string, name: string, hexes: readonly string[]): Palette {
  const swatches = hexes.map((hex, index) => ({ number: index + 1, hex }))
  const large = swatches[0]
  const small = swatches[11]
  if (!large || !small) throw new Error(`${name} needs 12 swatches`)
  return {
    id,
    name,
    swatches,
    colors: { large: large.hex, small: small.hex, background: TANT_PAPER },
  }
}

/**
 * Studio presets. Classic palettes are a small color, a large color, and paper.
 * TANT palettes are twelve numbered papers, read left to right, top to bottom,
 * matching the printed packaging swatches. Large tiles start on swatch 1 and
 * small tiles start on swatch 12.
 */
export const PALETTES: readonly Palette[] = [
  {
    id: 'warm-neutral',
    name: 'Warm Neutral',
    colors: {
      small: '#d8c7b4',
      large: '#6a5344',
      background: '#f6f1e8',
    },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    colors: {
      small: '#d7d7d4',
      large: '#1c1c1c',
      background: '#f4f4f2',
    },
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    colors: {
      small: '#c5d6df',
      large: '#1d4e68',
      background: '#f3f7f8',
    },
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    colors: {
      small: '#f0d4d6',
      large: '#9c3f56',
      background: '#fbf6f5',
    },
  },
  tantPalette('tant-blue', 'TANT Blue', TANT_BLUE),
  tantPalette('tant-yellow', 'TANT Yellow', TANT_YELLOW),
  tantPalette('tant-green', 'TANT Green', TANT_GREEN),
  tantPalette('tant-red', 'TANT Red', TANT_RED),
]

export const DEFAULT_PALETTE_ID = 'warm-neutral'

export function getPalette(id: string): Palette | undefined {
  return PALETTES.find((palette) => palette.id === id)
}

export function paletteSwatches(id: string): readonly Swatch[] | undefined {
  return getPalette(id)?.swatches
}

export function tantPalettes(): readonly Palette[] {
  return PALETTES.filter((palette) => palette.swatches !== undefined)
}

/** Distinct swatch colors from the given palettes, in palette then swatch order. */
export function swatchHexes(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const hexes: string[] = []
  for (const id of ids) {
    for (const swatch of paletteSwatches(id) ?? []) {
      const key = swatch.hex.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      hexes.push(swatch.hex)
    }
  }
  return hexes
}

export function findPaletteId(colors: TileColors): string {
  const match = PALETTES.find(
    (palette) =>
      !palette.swatches &&
      palette.colors.small.toLowerCase() === colors.small.toLowerCase() &&
      palette.colors.large.toLowerCase() === colors.large.toLowerCase() &&
      palette.colors.background.toLowerCase() === colors.background.toLowerCase(),
  )
  return match?.id ?? 'custom'
}

export function defaultColors(): TileColors {
  const palette = PALETTES[0]
  if (!palette) throw new Error('Tileprint has no palettes configured.')
  return { ...palette.colors }
}

export function swatchNumber(paletteId: string, hex: string): number | null {
  const swatches = paletteSwatches(paletteId)
  if (!swatches) return null
  const needle = hex.trim().toLowerCase()
  const found = swatches.find((swatch) => swatch.hex.toLowerCase() === needle)
  return found?.number ?? null
}

export function swatchHex(paletteId: string, number: number): string | null {
  return paletteSwatches(paletteId)?.find((swatch) => swatch.number === number)?.hex ?? null
}

function channel(value: number): number {
  const unit = value / 255
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

/** Black or white, whichever contrasts more with the swatch. */
export function swatchInk(hex: string): '#111111' | '#ffffff' {
  const body = hex.trim().replace('#', '')
  const red = Number.parseInt(body.slice(0, 2), 16)
  const green = Number.parseInt(body.slice(2, 4), 16)
  const blue = Number.parseInt(body.slice(4, 6), 16)
  const luminance = 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  const black = (luminance + 0.05) / 0.05
  const white = 1.05 / (luminance + 0.05)
  return black >= white ? '#111111' : '#ffffff'
}

function remapHex(fromId: string, toId: string, hex: string): string {
  const number = swatchNumber(fromId, hex)
  if (number === null) return hex
  return swatchHex(toId, number) ?? hex
}

export interface PaletteChange {
  paletteId: string
  colors: TileColors
  paints: TileColorMap
}

/**
 * Switching TANT families keeps each tile on the same swatch number.
 * A hex that is not in the current family stays as a custom color.
 * Entering or leaving a TANT family clears individual paints and uses that
 * preset's small, large, and paper colors.
 */
export function changePalette(
  fromId: string,
  toId: string,
  colors: TileColors,
  paints: TileColorMap,
): PaletteChange {
  const next = getPalette(toId)
  if (!next) return { paletteId: fromId, colors, paints }
  const fromTant = paletteSwatches(fromId) !== undefined
  const toTant = next.swatches !== undefined
  if (fromTant && toTant) {
    return {
      paletteId: toId,
      colors: {
        small: remapHex(fromId, toId, colors.small),
        large: remapHex(fromId, toId, colors.large),
        background: colors.background,
      },
      paints: Object.fromEntries(
        Object.entries(paints).map(([key, hex]) => [key, remapHex(fromId, toId, hex)]),
      ),
    }
  }
  return { paletteId: toId, colors: { ...next.colors }, paints: {} }
}
