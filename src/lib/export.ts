import { paletteSwatches } from '../config/palettes.ts'
import type { DisplaySettings, TileColorMap, TileColors, TileOrigin } from '../types/tileprint.ts'
import { ENCODING_VERSION } from '../types/tileprint.ts'
import { patternIdFromSerialization } from './fingerprint.ts'
import { canonicalSerialization, serializeTiles, sortOrigins, validateCoverage } from './geometry.ts'
import { composeArtwork, tiltTransform, VIEWBOX, type DrawCommand } from './render.ts'
import { assemblyTiles, type AssemblyTile } from './tileColors.ts'

export const PNG_EXPORT_SIZE = 3000

export interface TileprintExport {
  encodingVersion: typeof ENCODING_VERSION
  originalText: string
  normalizedText: string
  sha256: string
  canonical: {
    serialization: string
    identifier: string
    largeTiles: TileOrigin[]
  }
  displayed: {
    largeTiles: TileOrigin[]
    isCanonical: boolean
    rotation: DisplaySettings['rotation']
  }
  colors: TileColors
  paletteId: string
  tileColors: TileColorMap
  assembly: AssemblyTile[]
  display: DisplaySettings
}

export interface ExportInput {
  originalText: string
  normalizedText: string
  sha256: string
  canonicalTiles: readonly TileOrigin[]
  displayTiles: readonly TileOrigin[]
  colors: TileColors
  paletteId: string
  tileColors?: TileColorMap
  display: DisplaySettings
}

export function buildExportDocument(input: ExportInput): TileprintExport {
  const serialization = serializeTiles(input.canonicalTiles)
  const tileColors = { ...(input.tileColors ?? {}) }
  return {
    encodingVersion: ENCODING_VERSION,
    originalText: input.originalText,
    normalizedText: input.normalizedText,
    sha256: input.sha256,
    canonical: {
      serialization,
      identifier: patternIdFromSerialization(serialization),
      largeTiles: sortOrigins(input.canonicalTiles),
    },
    displayed: {
      largeTiles: sortOrigins(input.displayTiles),
      isCanonical:
        validateCoverage(input.displayTiles).ok &&
        canonicalSerialization(input.displayTiles) === serialization,
      rotation: input.display.rotation,
    },
    colors: { ...input.colors },
    paletteId: input.paletteId,
    tileColors,
    assembly: assemblyTiles(input.displayTiles, input.colors, tileColors, input.paletteId),
    display: { ...input.display },
  }
}

export function serializeExportJson(input: ExportInput): string {
  return `${JSON.stringify(buildExportDocument(input), null, 2)}\n`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}

function renderCommand(command: Exclude<DrawCommand, { type: 'text' }>): string {
  if (command.type === 'circle') {
    const opacity =
      command.fillOpacity === undefined ? '' : ` fill-opacity="${formatNumber(command.fillOpacity)}"`
    return `<circle cx="${formatNumber(command.cx)}" cy="${formatNumber(command.cy)}" r="${formatNumber(command.r)}" fill="${escapeXml(command.fill)}"${opacity} />`
  }

  const attrs = [
    `x="${formatNumber(command.x)}"`,
    `y="${formatNumber(command.y)}"`,
    `width="${formatNumber(command.w)}"`,
    `height="${formatNumber(command.h)}"`,
    `fill="${escapeXml(command.fill)}"`,
  ]
  if (command.fillOpacity !== undefined) attrs.push(`fill-opacity="${formatNumber(command.fillOpacity)}"`)
  if (command.stroke) attrs.push(`stroke="${escapeXml(command.stroke)}"`)
  if (command.strokeWidth !== undefined) attrs.push(`stroke-width="${formatNumber(command.strokeWidth)}"`)
  if (command.strokeDasharray) attrs.push(`stroke-dasharray="${command.strokeDasharray}"`)
  if (command.strokeOpacity !== undefined) {
    attrs.push(`stroke-opacity="${formatNumber(command.strokeOpacity)}"`)
  }
  return `<rect ${attrs.join(' ')} />`
}

function renderText(command: DrawCommand & { type: 'text' }, tiltDegrees = 0): string {
  const upright =
    tiltDegrees === 0
      ? ''
      : ` transform="rotate(${-tiltDegrees} ${formatNumber(command.x)} ${formatNumber(command.y)})"`
  return `<text x="${formatNumber(command.x)}" y="${formatNumber(command.y)}" fill="${escapeXml(command.fill)}" font-size="${formatNumber(command.fontSize)}" text-anchor="middle" dominant-baseline="central" font-family="Outfit, sans-serif" pointer-events="none"${upright}>${escapeXml(command.text)}</text>`
}

export function buildSvgString(options: {
  tiles: readonly TileOrigin[]
  colors: TileColors
  display: DisplaySettings
  title?: string
  paints?: TileColorMap
  paletteId?: string
}): string {
  const scene = composeArtwork({
    ...options,
    includeHints: false,
    swatches: options.paletteId ? paletteSwatches(options.paletteId) : undefined,
  })
  const title = options.title ? `\n  <title>${escapeXml(options.title)}</title>` : ''
  const markup = (command: DrawCommand) =>
    command.type === 'text' ? renderText(command, scene.tilt.degrees) : renderCommand(command)
  const transform = tiltTransform(scene.tilt)
  const body = transform
    ? `  <g transform="${transform}">\n${scene.commands.map((command) => `    ${markup(command)}`).join('\n')}\n  </g>`
    : scene.commands.map((command) => `  ${markup(command)}`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}" shape-rendering="geometricPrecision">${title}\n${body}\n</svg>\n`
}

export function artworkFilename(normalized: string, patternId: string, extension: string): string {
  const slug = normalized
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `tileprint-${slug || 'untitled'}-${patternId}.${extension}`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadText(filename: string, contents: string, type: string): void {
  downloadBlob(new Blob([contents], { type }), filename)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The artwork could not be drawn for export.'))
    image.src = url
  })
}

export async function exportPng(
  svg: string,
  filename: string,
  pixels = PNG_EXPORT_SIZE,
): Promise<void> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = pixels
    canvas.height = pixels
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas export is unavailable in this browser.')
    context.drawImage(image, 0, 0, pixels, pixels)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('PNG encoding failed.'))
      }, 'image/png')
    })
    downloadBlob(png, filename)
  } finally {
    URL.revokeObjectURL(url)
  }
}
