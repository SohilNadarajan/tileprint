import { describe, expect, it } from 'vitest'
import { DEFAULT_DISPLAY } from '../types/tileprint.ts'
import type { SavedArtwork } from '../types/tileprint.ts'
import { addArtwork, deleteArtwork, GALLERY_STORAGE_KEY, loadGallery, type GalleryStorage } from './storage.ts'

function memory(): GalleryStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

function piece(overrides: Partial<SavedArtwork> = {}): SavedArtwork {
  return {
    id: 'piece-1',
    originalText: 'NARA',
    normalizedText: 'NARA',
    encodingVersion: 'v3',
    sha256: '768c1c18e03c1f16682f971abe5086bdd9abc5458e9e22a04ba9403f4228e588',
    canonicalTiles: [{ row: 0, col: 0 }, { row: 2, col: 3 }, { row: 5, col: 5 }],
    canonicalSerialization: '00233555',
    patternId: 'TP-TESTTEST',
    displayTiles: [{ row: 0, col: 0 }, { row: 2, col: 3 }, { row: 5, col: 5 }],
    isCanonical: true,
    paletteId: 'warm-neutral',
    colors: { small: '#d8c7b4', large: '#6a5344', background: '#f6f1e8' },
    tileColors: {},
    display: DEFAULT_DISPLAY,
    createdAt: '2026-11-16T12:00:00.000Z',
    ...overrides,
  }
}

describe('gallery storage', () => {
  it('saves, reopens, and deletes independent artworks', () => {
    const storage = memory()
    expect(loadGallery(storage)).toEqual([])

    const canonical = piece()
    const creative = piece({
      id: 'piece-2',
      originalText: 'Osaka',
      normalizedText: 'osaka',
      displayTiles: [{ row: 2, col: 3 }],
      isCanonical: false,
      paletteId: 'custom',
      colors: { small: '#111111', large: '#222222', background: '#ffffff' },
    })

    addArtwork(canonical, storage)
    const saved = addArtwork(creative, storage)
    expect(saved.map((item) => item.id)).toEqual(['piece-2', 'piece-1'])

    const loaded = loadGallery(storage)
    expect(loaded).toEqual(saved)
    const reopened = loaded.find((item) => item.id === 'piece-2')
    expect(reopened?.canonicalTiles).toEqual(canonical.canonicalTiles)
    expect(reopened?.displayTiles).toEqual([{ row: 2, col: 3 }])
    expect(reopened?.isCanonical).toBe(false)
    expect(reopened?.canonicalSerialization).toBe(canonical.canonicalSerialization)

    expect(deleteArtwork('piece-1', storage).map((item) => item.id)).toEqual(['piece-2'])
    expect(loadGallery(storage)).toHaveLength(1)
  })

  it('ignores corrupt records and keeps valid ones', () => {
    const storage = memory()
    storage.setItem(
      GALLERY_STORAGE_KEY,
      JSON.stringify([piece(), { id: 'broken', encodingVersion: 'v1' }, null, 'nope']),
    )
    expect(loadGallery(storage).map((item) => item.id)).toEqual(['piece-1'])

    storage.setItem('tileprint.gallery.v1', JSON.stringify([piece({ id: 'legacy-v1' })]))
    storage.setItem(
      'tileprint.gallery.v2',
      JSON.stringify([{ id: 'legacy-v2', encodingVersion: 'v2', originalText: 'Kyoto' }]),
    )
    expect(loadGallery(storage).map((item) => item.id)).toEqual(['piece-1'])

    storage.setItem(GALLERY_STORAGE_KEY, '{')
    expect(loadGallery(storage)).toEqual([])
    storage.setItem(GALLERY_STORAGE_KEY, '"not-a-list"')
    expect(loadGallery(storage)).toEqual([])
  })

  it('restores palette, tile colors, and number visibility', () => {
    const storage = memory()
    const legacy = piece({ id: 'legacy-v3', patternId: 'TP-7E90C160' })
    const stored = structuredClone(legacy) as unknown as Record<string, unknown>
    delete stored.tileColors
    const display = { ...(stored.display as Record<string, unknown>) }
    delete display.showNumbers
    stored.display = display
    storage.setItem(GALLERY_STORAGE_KEY, JSON.stringify([stored]))

    const restored = loadGallery(storage)[0]
    expect(restored?.tileColors).toEqual({})
    expect(restored?.display.showNumbers).toBe(false)
    expect(restored?.patternId).toBe('TP-7E90C160')
    expect(restored?.canonicalSerialization).toBe(legacy.canonicalSerialization)

    const numbered = piece({
      id: 'tant-piece',
      paletteId: 'tant-blue',
      colors: { small: '#AAD7E9', large: '#027EBF', background: '#f6f1e8' },
      tileColors: { 'l:0,0': '#122F7A', 's:3,3': '#010203' },
      display: { ...DEFAULT_DISPLAY, showNumbers: true },
    })
    addArtwork(numbered, storage)
    const opened = loadGallery(storage).find((item) => item.id === 'tant-piece')
    expect(opened?.paletteId).toBe('tant-blue')
    expect(opened?.tileColors).toEqual({ 'l:0,0': '#122F7A', 's:3,3': '#010203' })
    expect(opened?.display.showNumbers).toBe(true)
    expect(opened?.colors).toEqual(numbered.colors)
    expect(opened?.canonicalSerialization).toBe(numbered.canonicalSerialization)
  })
})
