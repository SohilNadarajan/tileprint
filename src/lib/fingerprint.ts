import { GRID_SIZE, MAX_LARGE_TILES, MIN_LARGE_TILES } from '../types/tileprint.ts'
import type { TileOrigin } from '../types/tileprint.ts'
import {
  canonicalSerialization,
  canonicalizeTiles,
  chebyshev,
  serializeTiles,
  validateCoverage,
} from './geometry.ts'
import { createPrng, seedFromSha256 } from './prng.ts'

export const HASH_PREFIX = 'tileprint:v3:'
export const FNV_OFFSET = 0x811c9dc5
export const FNV_PRIME = 0x01000193

const ORIGIN_SPAN = GRID_SIZE - 1

/** NFC, trim, then the Unicode default lowercase mapping. Not a locale mapping. */
export function normalizeMessage(text: string): string {
  return text.normalize('NFC').trim().toLowerCase()
}

export function hashPayload(normalized: string): Uint8Array {
  return new TextEncoder().encode(`${HASH_PREFIX}${normalized}`)
}

export async function sha256Bytes(payload: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', payload as BufferSource)
  return new Uint8Array(digest)
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** FNV-1a 32-bit over the ASCII serialization. The identifier names the geometry, not the message. */
export function patternIdFromSerialization(serialization: string): string {
  let hash = FNV_OFFSET
  for (let index = 0; index < serialization.length; index += 1) {
    hash ^= serialization.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return `TP-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

function allOrigins(): TileOrigin[] {
  const origins: TileOrigin[] = []
  for (let row = 0; row < ORIGIN_SPAN; row += 1) {
    for (let col = 0; col < ORIGIN_SPAN; col += 1) origins.push({ row, col })
  }
  return origins
}

function fisherYates(rng: ReturnType<typeof createPrng>, items: TileOrigin[]): TileOrigin[] {
  const order = items.map((item) => ({ row: item.row, col: item.col }))
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = rng.nextInt(index + 1)
    const current = order[index]
    const other = order[swap]
    if (!current || !other) throw new Error('Shuffle index fell outside the origin list')
    order[index] = other
    order[swap] = current
  }
  return order
}

function accepts(chosen: readonly TileOrigin[], origin: TileOrigin, separation: number): boolean {
  return chosen.every((tile) => chebyshev(tile, origin) >= separation)
}

/**
 * Walk the shuffled origins at Chebyshev separations 4, then 3, then 2.
 * Separation 2 is non-overlapping (tiles may touch). Wider separations leave a gap.
 * The walk stops at `count` tiles. If a partial selection cannot be finished,
 * search the same order depth-first for any non-overlapping selection of `count`.
 */
function selectTiles(order: readonly TileOrigin[], count: number): TileOrigin[] {
  const chosen: TileOrigin[] = []
  for (const separation of [4, 3, 2]) {
    for (const origin of order) {
      if (chosen.length === count) return chosen
      if (accepts(chosen, origin, separation)) chosen.push(origin)
    }
  }
  if (chosen.length === count) return chosen

  const solved: TileOrigin[] = []
  const visit = (start: number): boolean => {
    if (solved.length === count) return true
    if (solved.length + (order.length - start) < count) return false
    for (let index = start; index < order.length; index += 1) {
      const origin = order[index]
      if (!origin || !accepts(solved, origin, 2)) continue
      solved.push(origin)
      if (visit(index + 1)) return true
      solved.pop()
    }
    return false
  }

  if (!visit(0)) {
    throw new Error('Tileprint could not place the requested tiles')
  }
  return solved
}

export interface Fingerprint {
  originalText: string
  normalizedText: string
  sha256: string
  largeTiles: TileOrigin[]
  serialization: string
  patternId: string
}

/**
 * Deterministic geometric fingerprint.
 * Draw the tile count, shuffle the 49 origins, place the tiles, then keep the
 * lexicographically smallest rotation. Colors are not an input.
 */
export async function generateFingerprint(originalText: string): Promise<Fingerprint | null> {
  const normalizedText = normalizeMessage(originalText)
  if (!normalizedText) return null

  const digest = await sha256Bytes(hashPayload(normalizedText))
  const rng = createPrng(seedFromSha256(digest))
  const count = MIN_LARGE_TILES + rng.nextInt(MAX_LARGE_TILES - MIN_LARGE_TILES + 1)
  const placed = selectTiles(fisherYates(rng, allOrigins()), count)
  const largeTiles = canonicalizeTiles(placed)
  const serialization = serializeTiles(largeTiles)
  const coverage = validateCoverage(largeTiles)
  if (!coverage.ok || largeTiles.length !== count) {
    throw new Error('Tileprint produced a pattern that does not cover the sheet')
  }

  return {
    originalText,
    normalizedText,
    sha256: toHex(digest),
    largeTiles,
    serialization,
    patternId: patternIdFromSerialization(serialization),
  }
}

export function sameArrangement(tiles: readonly TileOrigin[], serialization: string): boolean {
  const coverage = validateCoverage(tiles)
  if (!coverage.ok) return false
  return canonicalSerialization(tiles) === serialization
}

export interface ArrangementStatus {
  matches: boolean
  summary: string
}

export function arrangementStatus(
  tiles: readonly TileOrigin[],
  serialization: string,
): ArrangementStatus {
  if (sameArrangement(tiles, serialization)) {
    return { matches: true, summary: 'Canonical fingerprint.' }
  }
  return {
    matches: false,
    summary: 'This arrangement no longer matches the fingerprint.',
  }
}

export interface Comparison {
  match: boolean
  label: 'Match' | 'No match'
  detail: string
  patternId: string | null
}

/** Compare a rebuilt sheet with the fingerprint of a candidate message. Rotations compare equal. */
export async function compareFingerprint(
  message: string,
  tiles: readonly TileOrigin[],
): Promise<Comparison> {
  const fingerprint = await generateFingerprint(message)
  if (!fingerprint) {
    return {
      match: false,
      label: 'No match',
      detail: 'Enter the name or title you want to check.',
      patternId: null,
    }
  }

  if (sameArrangement(tiles, fingerprint.serialization)) {
    return {
      match: true,
      label: 'Match',
      detail: `This sheet matches the fingerprint of “${fingerprint.normalizedText}”.`,
      patternId: fingerprint.patternId,
    }
  }

  const coverage = validateCoverage(tiles)
  const reason = coverage.ok
    ? `This sheet does not match the fingerprint of “${fingerprint.normalizedText}”.`
    : 'These tiles overlap or sit outside the sheet, so they do not match.'
  return {
    match: false,
    label: 'No match',
    detail: `${reason} A fingerprint cannot be reversed to recover the message.`,
    patternId: fingerprint.patternId,
  }
}
