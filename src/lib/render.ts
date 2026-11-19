import type { Swatch } from '../config/palettes.ts'
import { swatchInk, swatchNumber } from '../config/palettes.ts'
import type { DisplaySettings, TileColorMap, TileColors, TileOrigin } from '../types/tileprint.ts'
import { GRID_SIZE } from '../types/tileprint.ts'
import { mergeCandidates, rotateOrigin, sortOrigins, unrotateCell } from './geometry.ts'
import { tileHex } from './tileColors.ts'

export const VIEWBOX = 1000
export const FRAME_THICKNESS = 28
export const MAT_THICKNESS = 64
export const PAPER_PADDING = 32
export const UNFRAMED_MARGIN = 36
export const FRAME_COLOR = '#3a332d'
export const MAT_COLOR = '#e8e1d4'
export const FILLET_COLOR = '#2a2522'
export const HINT_RADIUS = 9

export interface GridMetrics {
  contentOrigin: number
  cell: number
  gap: number
  pitch: number
}

export interface LayoutTile {
  kind: 'small' | 'large' | 'hint'
  x: number
  y: number
  w: number
  h: number
  origin?: TileOrigin
  visualRow: number
  visualCol: number
}

interface RectCommand {
  type: 'rect'
  id: string
  x: number
  y: number
  w: number
  h: number
  fill: string
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  strokeOpacity?: number
  kind: string
}

interface CircleCommand {
  type: 'circle'
  id: string
  cx: number
  cy: number
  r: number
  fill: string
  fillOpacity?: number
  kind: 'hint'
}

interface TextCommand {
  type: 'text'
  id: string
  x: number
  y: number
  text: string
  fill: string
  fontSize: number
  kind: 'number'
}

export type DrawCommand = RectCommand | CircleCommand | TextCommand

export interface ArtworkScene {
  viewBox: number
  commands: DrawCommand[]
  largeTiles: LayoutTile[]
  smallTiles: LayoutTile[]
  hints: LayoutTile[]
  metrics: GridMetrics
}

export interface HitTarget {
  kind: 'split' | 'merge'
  origin: TileOrigin
}

export interface PaintTarget {
  kind: 'small' | 'large'
  origin: TileOrigin
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function gridMetrics(display: Pick<DisplaySettings, 'frame' | 'gap'>): GridMetrics {
  const contentOrigin = display.frame
    ? FRAME_THICKNESS + MAT_THICKNESS + PAPER_PADDING
    : UNFRAMED_MARGIN
  const contentSize = VIEWBOX - contentOrigin * 2
  let gap = Math.max(0, display.gap)
  let cell = (contentSize - gap * (GRID_SIZE - 1)) / GRID_SIZE

  if (cell < 8) {
    gap = Math.max(0, (contentSize - 8 * GRID_SIZE) / (GRID_SIZE - 1))
    cell = (contentSize - gap * (GRID_SIZE - 1)) / GRID_SIZE
  }

  return { contentOrigin, cell, gap, pitch: cell + gap }
}

export function tileRect(
  visual: TileOrigin,
  size: number,
  metrics: GridMetrics,
): { x: number; y: number; w: number; h: number } {
  const span = size * metrics.cell + (size - 1) * metrics.gap
  return {
    x: metrics.contentOrigin + visual.col * metrics.pitch,
    y: metrics.contentOrigin + visual.row * metrics.pitch,
    w: span,
    h: span,
  }
}

function strokeFor(display: DisplaySettings): Pick<RectCommand, 'stroke' | 'strokeWidth'> {
  if (!display.outlines || display.outlineWidth <= 0) return {}
  return { stroke: display.outlineColor, strokeWidth: display.outlineWidth }
}

function numberLabel(
  hex: string,
  swatches: readonly Swatch[] | undefined,
  paletteId: string | undefined,
): number | null {
  if (!swatches || !paletteId) return null
  return swatchNumber(paletteId, hex)
}

export function composeArtwork(options: {
  tiles: readonly TileOrigin[]
  colors: TileColors
  display: DisplaySettings
  includeHints: boolean
  paints?: TileColorMap
  paletteId?: string
  swatches?: readonly Swatch[]
}): ArtworkScene {
  const { tiles, colors, display, includeHints } = options
  const paints = options.paints ?? {}
  const metrics = gridMetrics(display)
  const commands: DrawCommand[] = []
  const tileStroke = strokeFor(display)

  if (display.frame) {
    commands.push({
      type: 'rect',
      id: 'frame',
      x: 0,
      y: 0,
      w: VIEWBOX,
      h: VIEWBOX,
      fill: FRAME_COLOR,
      kind: 'frame',
    })

    const matOrigin = FRAME_THICKNESS
    const matSize = VIEWBOX - FRAME_THICKNESS * 2
    commands.push({
      type: 'rect',
      id: 'mat',
      x: matOrigin,
      y: matOrigin,
      w: matSize,
      h: matSize,
      fill: MAT_COLOR,
      kind: 'mat',
    })

    const paperOrigin = FRAME_THICKNESS + MAT_THICKNESS
    const paperSize = VIEWBOX - paperOrigin * 2
    commands.push(
      {
        type: 'rect',
        id: 'paper',
        x: paperOrigin,
        y: paperOrigin,
        w: paperSize,
        h: paperSize,
        fill: colors.background,
        kind: 'paper',
      },
      {
        type: 'rect',
        id: 'fillet',
        x: paperOrigin,
        y: paperOrigin,
        w: paperSize,
        h: paperSize,
        fill: 'none',
        stroke: FILLET_COLOR,
        strokeWidth: 3,
        kind: 'fillet',
      },
    )
  } else {
    commands.push({
      type: 'rect',
      id: 'paper',
      x: 0,
      y: 0,
      w: VIEWBOX,
      h: VIEWBOX,
      fill: colors.background,
      kind: 'paper',
    })
  }

  const covered = new Set<string>()
  const largeTiles: LayoutTile[] = sortOrigins(tiles).map((origin) => {
    const visual = rotateOrigin(origin, display.rotation)
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        covered.add(`${visual.row + row},${visual.col + col}`)
      }
    }
    return {
      kind: 'large',
      ...tileRect(visual, 2, metrics),
      origin,
      visualRow: visual.row,
      visualCol: visual.col,
    }
  })

  const smallTiles: LayoutTile[] = []
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (covered.has(`${row},${col}`)) continue
      smallTiles.push({
        kind: 'small',
        ...tileRect({ row, col }, 1, metrics),
        origin: unrotateCell(row, col, display.rotation),
        visualRow: row,
        visualCol: col,
      })
    }
  }

  const fontSize = round(metrics.cell * 0.34)
  const showNumbers = display.showNumbers === true

  function pushTile(tile: LayoutTile, index: number, kind: 'small' | 'large') {
    const origin = tile.origin
    const fill = origin ? tileHex(paints, kind, origin, colors) : kind === 'large' ? colors.large : colors.small
    commands.push({
      type: 'rect',
      id: `${kind}-${index}`,
      x: round(tile.x),
      y: round(tile.y),
      w: round(tile.w),
      h: round(tile.h),
      fill,
      kind,
      ...tileStroke,
    })
    const swatch = showNumbers ? numberLabel(fill, options.swatches, options.paletteId) : null
    if (swatch !== null) {
      commands.push({
        type: 'text',
        id: `number-${kind}-${index}`,
        x: round(tile.x + tile.w / 2),
        y: round(tile.y + tile.h / 2),
        text: String(swatch),
        fill: swatchInk(fill),
        fontSize,
        kind: 'number',
      })
    }
  }

  smallTiles.forEach((tile, index) => pushTile(tile, index, 'small'))
  largeTiles.forEach((tile, index) => pushTile(tile, index, 'large'))

  const hints: LayoutTile[] = []
  if (includeHints) {
    for (const origin of mergeCandidates(tiles)) {
      const visual = rotateOrigin(origin, display.rotation)
      const rect = tileRect(visual, 2, metrics)
      hints.push({
        kind: 'hint',
        ...rect,
        origin,
        visualRow: visual.row,
        visualCol: visual.col,
      })
      commands.push({
        type: 'circle',
        id: `hint-${origin.row}-${origin.col}`,
        cx: round(rect.x + rect.w / 2),
        cy: round(rect.y + rect.h / 2),
        r: HINT_RADIUS,
        fill: colors.large,
        fillOpacity: 0.42,
        kind: 'hint',
      })
    }
  }

  return { viewBox: VIEWBOX, commands, largeTiles, smallTiles, hints, metrics }
}

export function paintHit(scene: ArtworkScene, x: number, y: number): PaintTarget | null {
  for (const tile of scene.largeTiles) {
    if (tile.origin && containsPoint(tile, x, y)) return { kind: 'large', origin: tile.origin }
  }
  for (const tile of scene.smallTiles) {
    if (tile.origin && containsPoint(tile, x, y)) return { kind: 'small', origin: tile.origin }
  }
  return null
}

export function containsPoint(
  rect: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h
}

export function hitTest(scene: ArtworkScene, x: number, y: number): HitTarget | null {
  for (const tile of scene.largeTiles) {
    if (tile.origin && containsPoint(tile, x, y)) {
      return { kind: 'split', origin: tile.origin }
    }
  }

  let best: LayoutTile | undefined
  let bestDistance = Infinity
  for (const hint of scene.hints) {
    if (!hint.origin || !containsPoint(hint, x, y)) continue
    const dx = hint.x + hint.w / 2 - x
    const dy = hint.y + hint.h / 2 - y
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      best = hint
      bestDistance = distance
    }
  }

  return best?.origin ? { kind: 'merge', origin: best.origin } : null
}
