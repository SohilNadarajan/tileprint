import { useState } from 'react'
import { Trash } from 'lucide-react'
import { ArtworkCanvas } from './ArtworkCanvas.tsx'
import { paletteSwatches } from '../config/palettes.ts'
import type { SavedArtwork } from '../types/tileprint.ts'

interface GalleryProps {
  items: readonly SavedArtwork[]
  onOpen: (item: SavedArtwork) => void
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Gallery({ items, onOpen, onDelete }: GalleryProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  function requestDelete(id: string) {
    if (pendingId === id) {
      onDelete(id)
      setPendingId(null)
      return
    }
    setPendingId(id)
  }

  return (
    <section id="collection" className="border-t border-line bg-paper-deep/40 px-6 py-12 sm:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-4xl tracking-tight">Collection</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Saved in this browser. Each artwork is its own frame.
          </p>
        </div>
        <p className="text-sm text-muted">{items.length === 1 ? '1 piece' : `${items.length} pieces`}</p>
      </div>

      {items.length === 0 ? (
        <p className="max-w-md font-serif text-2xl leading-snug text-muted">
          Nothing saved yet. When a piece feels right, keep it here.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => {
            const title = item.originalText.trim() || 'Untitled'
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="block w-full text-left"
                >
                  <span className="block aspect-square overflow-hidden bg-panel shadow-[0_16px_40px_-24px_rgba(48,32,16,0.65)]">
                    <ArtworkCanvas
                      tiles={item.displayTiles}
                      colors={item.colors}
                      paints={item.tileColors}
                      paletteId={item.paletteId}
                      swatches={paletteSwatches(item.paletteId)}
                      display={item.display}
                      label={`${title} thumbnail`}
                      className="block h-full w-full"
                    />
                  </span>
                </button>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-xl leading-tight">{title}</p>
                    <p className="mt-1 text-xs tracking-wide text-muted">
                      {item.isCanonical ? item.patternId : 'Customized'}
                      {formatDate(item.createdAt) ? ` · ${formatDate(item.createdAt)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestDelete(item.id)}
                    aria-label={pendingId === item.id ? `Confirm delete ${title}` : `Delete ${title}`}
                    className="shrink-0 text-faint hover:text-ink"
                  >
                    {pendingId === item.id ? (
                      <span className="text-xs tracking-wide text-ink">Remove</span>
                    ) : (
                      <Trash size={15} strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
