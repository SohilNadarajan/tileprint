import { useEffect, useMemo, useRef, useState } from 'react'
import { ArtworkCanvas } from './components/ArtworkCanvas.tsx'
import { DecoderPanel } from './components/DecoderPanel.tsx'
import { EncoderPanel } from './components/EncoderPanel.tsx'
import { Gallery } from './components/Gallery.tsx'
import { changePalette, defaultColors, findPaletteId, paletteSwatches, swatchHex, swatchHexes } from './config/palettes.ts'
import {
  arrangementStatus,
  compareFingerprint,
  generateFingerprint,
  type Comparison,
  type Fingerprint,
} from './lib/fingerprint.ts'
import { cloneTiles, mergeLargeTile, rotateTiles, smallTileCount, splitLargeTile } from './lib/geometry.ts'
import { randomAssignment, randomInt, uniformAssignment } from './lib/colorRandom.ts'
import { colorsAfterMerge, colorsAfterSplit, paintTile, physicalTiles } from './lib/tileColors.ts'
import { addArtwork, deleteArtwork, loadGallery } from './lib/storage.ts'
import { DEFAULT_DISPLAY, ENCODING_VERSION, MAX_LARGE_TILES } from './types/tileprint.ts'
import type { DisplaySettings, SavedArtwork, TileColorMap, TileColors, TileOrigin } from './types/tileprint.ts'

type StudioMode = 'generate' | 'verify'

export default function App() {
  const [mode, setMode] = useState<StudioMode>('generate')
  const [text, setText] = useState('NARA')
  const [creative, setCreative] = useState(false)
  const [paletteId, setPaletteId] = useState('warm-neutral')
  const [colors, setColors] = useState<TileColors>(() => defaultColors())
  const [paints, setPaints] = useState<TileColorMap>({})
  const [brush, setBrush] = useState(1)
  const [painting, setPainting] = useState(false)
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY)
  const [artwork, setArtwork] = useState<Fingerprint | null>(null)
  const [displayTiles, setDisplayTiles] = useState<TileOrigin[]>([])
  const [gallery, setGallery] = useState<SavedArtwork[]>(() => {
    try {
      return loadGallery()
    } catch {
      return []
    }
  })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [verifyMessage, setVerifyMessage] = useState('')
  const [verifyBoard, setVerifyBoard] = useState<TileOrigin[]>([])
  const [verifyUndo, setVerifyUndo] = useState<TileOrigin[][]>([])
  const [verifyResult, setVerifyResult] = useState<Comparison | null>(null)
  const [verifyPending, setVerifyPending] = useState(false)
  const followRef = useRef(true)

  useEffect(() => {
    let active = true
    const follow = followRef.current
    void generateFingerprint(text).then((result) => {
      if (!active) return
      setArtwork(result)
      if (follow) {
        setDisplayTiles(result ? cloneTiles(result.largeTiles) : [])
        setPaints({})
      }
    })
    return () => {
      active = false
    }
  }, [text])

  useEffect(() => {
    if (!saved) return
    const handle = window.setTimeout(() => setSaved(false), 1600)
    return () => window.clearTimeout(handle)
  }, [saved])

  const reading = useMemo(
    () => (artwork ? arrangementStatus(displayTiles, artwork.serialization) : null),
    [artwork, displayTiles],
  )

  function updateText(next: string) {
    followRef.current = true
    setSaved(false)
    setText(next)
  }

  function choosePalette(id: string) {
    const next = changePalette(paletteId, id, colors, paints)
    setPaletteId(next.paletteId)
    setColors(next.colors)
    setPaints(next.paints)
    if (!paletteSwatches(next.paletteId)) setPainting(false)
  }

  function changeColor(key: keyof TileColors, value: string) {
    const next = { ...colors, [key]: value }
    setColors(next)
    if (!paletteSwatches(paletteId)) setPaletteId(findPaletteId(next))
  }

  function applyColoring(hexes: readonly string[], mode: 'random' | 'uniform') {
    if (hexes.length === 0) return
    const pieces = physicalTiles(displayTiles)
    setPaints(
      mode === 'uniform'
        ? uniformAssignment(pieces, hexes, randomInt)
        : randomAssignment(pieces, hexes, randomInt),
    )
    setPainting(false)
  }

  function paintOrigin(kind: 'small' | 'large', origin: TileOrigin) {
    const hex = swatchHex(paletteId, brush)
    if (!hex) return
    setPaints((current) => paintTile(current, kind, origin, hex))
  }

  function editEncoderTiles(next: TileOrigin[]) {
    setDisplayTiles(next)
  }

  function mergeEncoder(origin: TileOrigin) {
    if (displayTiles.length >= MAX_LARGE_TILES) return
    const next = mergeLargeTile(displayTiles, origin)
    if (!next) return
    setPaints((current) => colorsAfterMerge(origin, current, colors))
    editEncoderTiles(next)
  }

  function commitVerify(next: TileOrigin[]) {
    setVerifyUndo((stack) => [...stack.slice(-50), verifyBoard])
    setVerifyBoard(next)
    setVerifyResult(null)
  }

  function mergeVerify(origin: TileOrigin) {
    if (verifyBoard.length >= MAX_LARGE_TILES) return
    const next = mergeLargeTile(verifyBoard, origin)
    if (next) commitVerify(next)
  }

  function openArtwork(item: SavedArtwork) {
    followRef.current = false
    setMode('generate')
    setText(item.originalText)
    setDisplayTiles(cloneTiles(item.displayTiles))
    setCreative(!item.isCanonical)
    setPaletteId(item.paletteId)
    setColors({ ...item.colors })
    setPaints({ ...item.tileColors })
    setPainting(false)
    setDisplay({ ...item.display, showNumbers: item.display.showNumbers === true })
    setSaved(false)
    setSaveError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function saveArtwork() {
    if (!artwork || !reading) return
    const item: SavedArtwork = {
      id: crypto.randomUUID(),
      originalText: artwork.originalText,
      normalizedText: artwork.normalizedText,
      encodingVersion: ENCODING_VERSION,
      sha256: artwork.sha256,
      canonicalTiles: cloneTiles(artwork.largeTiles),
      canonicalSerialization: artwork.serialization,
      patternId: artwork.patternId,
      displayTiles: cloneTiles(displayTiles),
      isCanonical: reading.matches,
      paletteId,
      colors: { ...colors },
      tileColors: { ...paints },
      display: { ...display },
      createdAt: new Date().toISOString(),
    }
    try {
      setGallery(addArtwork(item))
      setSaved(true)
      setSaveError('')
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not save this piece.')
    }
  }

  function removeArtwork(id: string) {
    try {
      setGallery(deleteArtwork(id))
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not remove this piece.')
    }
  }

  function changeVerifyMessage(next: string) {
    setVerifyMessage(next)
    setVerifyResult(null)
  }

  async function runComparison() {
    setVerifyPending(true)
    try {
      setVerifyResult(await compareFingerprint(verifyMessage, verifyBoard))
    } finally {
      setVerifyPending(false)
    }
  }

  const ready = artwork !== null
  const shownTiles = mode === 'verify' ? verifyBoard : displayTiles
  const showCanvas = mode === 'verify' || ready
  const caption = artwork ? artwork.originalText.trim() : 'Tileprint'

  return (
    <div className="min-h-svh bg-paper text-ink">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-paper/95 px-6 backdrop-blur-sm sm:px-8">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="font-serif text-[1.7rem] leading-none tracking-tight">Tileprint</h1>
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-faint sm:inline">Studio</span>
        </div>
        <div className="flex rounded-full border border-line p-1" role="tablist" aria-label="Studio mode">
          {(['generate', 'verify'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              onClick={() => setMode(tab)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                mode === tab ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              {tab === 'generate' ? 'Generator' : 'Verify'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col lg:grid lg:h-[calc(100svh-4rem)] lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="order-2 border-t border-line lg:order-1 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-r">
          {mode === 'generate' ? (
            <EncoderPanel
              text={text}
              normalizedText={artwork?.normalizedText ?? ''}
              ready={ready}
              creative={creative}
              customized={reading ? !reading.matches : false}
              largeCount={displayTiles.length}
              smallCount={smallTileCount(displayTiles.length)}
              patternId={artwork?.patternId ?? ''}
              summary={reading?.summary ?? 'Generating the fingerprint.'}
              sha256={artwork?.sha256 ?? ''}
              canonicalTiles={artwork?.largeTiles ?? []}
              displayTiles={displayTiles}
              colors={colors}
              paints={paints}
              paletteId={paletteId}
              swatches={paletteSwatches(paletteId)}
              brush={brush}
              painting={painting}
              display={display}
              onText={updateText}
              onCreative={(value) => {
                setCreative(value)
                if (value) setPainting(false)
              }}
              onReset={() => {
                if (!artwork) return
                setDisplayTiles(cloneTiles(artwork.largeTiles))
              }}
              onPalette={choosePalette}
              onColor={changeColor}
              onBrush={(number) => {
                setBrush(number)
                setPainting(true)
                setCreative(false)
              }}
              onPaintMode={(value) => {
                setPainting(value)
                if (value) setCreative(false)
              }}
              onRandomizePalette={() => applyColoring(swatchHexes([paletteId]), 'random')}
              onEvenSpread={() => applyColoring(swatchHexes([paletteId]), 'uniform')}
              onRandomizeFamilies={(ids) => applyColoring(swatchHexes(ids), 'random')}
              onDisplay={(patch) => setDisplay((current) => ({ ...current, ...patch }))}
            />
          ) : (
            <DecoderPanel
              message={verifyMessage}
              largeCount={verifyBoard.length}
              canUndo={verifyUndo.length > 0}
              result={verifyResult}
              pending={verifyPending}
              onMessage={changeVerifyMessage}
              onUndo={() => {
                const previous = verifyUndo[verifyUndo.length - 1]
                if (!previous) return
                setVerifyUndo((stack) => stack.slice(0, -1))
                setVerifyBoard(previous)
                setVerifyResult(null)
              }}
              onReset={() => {
                setVerifyUndo([])
                setVerifyBoard([])
                setVerifyResult(null)
              }}
              onRotate={() => commitVerify(rotateTiles(verifyBoard, 90))}
              onCompare={() => void runComparison()}
            />
          )}
        </aside>

        <main className="order-1 flex items-center justify-center px-6 py-8 sm:px-10 lg:order-2 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          <div className="w-full max-w-[640px] lg:max-w-[min(680px,calc(100svh-13rem))]">
            <div
              className={
                display.frame
                  ? 'shadow-[0_30px_70px_-34px_rgba(48,32,16,0.6)]'
                  : 'shadow-[0_24px_50px_-32px_rgba(48,32,16,0.45)] ring-1 ring-line'
              }
            >
              {showCanvas ? (
                <ArtworkCanvas
                  tiles={shownTiles}
                  colors={colors}
                  paints={mode === 'generate' ? paints : {}}
                  paletteId={paletteId}
                  swatches={paletteSwatches(paletteId)}
                  display={mode === 'verify' ? { ...display, rotation: 0 } : display}
                  creative={mode === 'verify' || creative}
                  painting={mode === 'generate' && painting}
                  label={
                    mode === 'verify'
                      ? `Verify sheet, ${verifyBoard.length} large tiles`
                      : `${caption}, ${reading?.matches ? 'canonical' : 'customized'} ${artwork?.patternId ?? ''}`
                  }
                  className="block h-auto w-full"
                  onPaint={(target) => paintOrigin(target.kind, target.origin)}
                  onSplit={(origin) => {
                    if (mode === 'verify') commitVerify(splitLargeTile(verifyBoard, origin))
                    else {
                      setPaints((current) => colorsAfterSplit(origin, current, colors))
                      editEncoderTiles(splitLargeTile(displayTiles, origin))
                    }
                  }}
                  onMerge={(origin) => {
                    if (mode === 'verify') mergeVerify(origin)
                    else mergeEncoder(origin)
                  }}
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-paper-deep px-10 text-center">
                  <p className="max-w-sm text-sm leading-relaxed text-muted">
                    {text.trim() ? 'Generating the fingerprint.' : 'Enter a name, place, or title.'}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-serif text-[2rem] leading-none tracking-tight">
                  {mode === 'verify' ? (verifyResult?.label ?? 'Verify') : ready ? caption : '—'}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {mode === 'verify'
                    ? verifyResult?.detail ?? `${verifyBoard.length} large tiles`
                    : reading?.summary ?? 'Generating the fingerprint.'}
                  {mode === 'generate' && artwork ? (
                    <>
                      <span className="px-1.5 text-faint">·</span>
                      <span className="font-mono text-xs tracking-wide">{artwork.patternId}</span>
                    </>
                  ) : null}
                </p>
                {saveError ? <p className="mt-2 text-sm text-ink">{saveError}</p> : null}
              </div>
              {mode === 'generate' ? (
                <button
                  type="button"
                  onClick={saveArtwork}
                  disabled={!ready}
                  className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:cursor-default disabled:opacity-40"
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <Gallery items={gallery} onOpen={openArtwork} onDelete={removeArtwork} />
    </div>
  )
}
