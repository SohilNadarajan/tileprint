import type { DisplaySettings, SavedArtwork, TileColorMap, TileColors, TileOrigin } from '../types/tileprint.ts'
import { ENCODING_VERSION } from '../types/tileprint.ts'

export const GALLERY_STORAGE_KEY = 'tileprint.gallery.v3'

export interface GalleryStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function browserStorage(): GalleryStorage {
  if (typeof localStorage === 'undefined') {
    throw new Error('Saving is unavailable in this browser.')
  }
  return localStorage
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTileOrigin(value: unknown): value is TileOrigin {
  return isRecord(value) && typeof value.row === 'number' && typeof value.col === 'number'
}

function isTileList(value: unknown): value is TileOrigin[] {
  return Array.isArray(value) && value.every(isTileOrigin)
}

function isColors(value: unknown): value is TileColors {
  return (
    isRecord(value) &&
    typeof value.small === 'string' &&
    typeof value.large === 'string' &&
    typeof value.background === 'string'
  )
}

function isDisplay(value: unknown): value is DisplaySettings {
  return (
    isRecord(value) &&
    (value.rotation === 0 ||
      value.rotation === 45 ||
      value.rotation === 90 ||
      value.rotation === 135 ||
      value.rotation === 180 ||
      value.rotation === 225 ||
      value.rotation === 270 ||
      value.rotation === 315) &&
    typeof value.outlines === 'boolean' &&
    typeof value.outlineColor === 'string' &&
    typeof value.outlineWidth === 'number' &&
    typeof value.gap === 'number' &&
    typeof value.frame === 'boolean'
  )
}

function isColorMap(value: unknown): value is TileColorMap {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  )
}

function normalizeArtwork(value: SavedArtwork): SavedArtwork {
  const stored = value as SavedArtwork & { tileColors?: unknown }
  return {
    ...value,
    tileColors: isColorMap(stored.tileColors) ? stored.tileColors : {},
    display: { ...value.display, showNumbers: value.display.showNumbers === true },
  }
}

function isSavedArtwork(value: unknown): value is SavedArtwork {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.originalText === 'string' &&
    typeof value.normalizedText === 'string' &&
    value.encodingVersion === ENCODING_VERSION &&
    typeof value.sha256 === 'string' &&
    isTileList(value.canonicalTiles) &&
    typeof value.canonicalSerialization === 'string' &&
    typeof value.patternId === 'string' &&
    isTileList(value.displayTiles) &&
    typeof value.isCanonical === 'boolean' &&
    typeof value.paletteId === 'string' &&
    isColors(value.colors) &&
    isDisplay(value.display) &&
    typeof value.createdAt === 'string'
  )
}

export function loadGallery(storage: GalleryStorage = browserStorage()): SavedArtwork[] {
  try {
    const raw = storage.getItem(GALLERY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => (isSavedArtwork(item) ? [normalizeArtwork(item)] : []))
  } catch {
    return []
  }
}

export function writeGallery(
  items: readonly SavedArtwork[],
  storage: GalleryStorage = browserStorage(),
): void {
  storage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(items))
}

export function addArtwork(
  item: SavedArtwork,
  storage: GalleryStorage = browserStorage(),
): SavedArtwork[] {
  const next = [item, ...loadGallery(storage)]
  writeGallery(next, storage)
  return next
}

export function deleteArtwork(
  id: string,
  storage: GalleryStorage = browserStorage(),
): SavedArtwork[] {
  const next = loadGallery(storage).filter((item) => item.id !== id)
  writeGallery(next, storage)
  return next
}
