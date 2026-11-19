import { useState } from 'react'
import { Braces, Download, ImageDown, RotateCcw } from 'lucide-react'
import { ColorControls } from './ColorControls.tsx'
import { PatternInfo } from './PatternInfo.tsx'
import {
  artworkFilename,
  buildSvgString,
  downloadText,
  exportPng,
  serializeExportJson,
} from '../lib/export.ts'
import type { Swatch } from '../config/palettes.ts'
import type { DisplaySettings, Rotation, TileColorMap, TileColors, TileOrigin } from '../types/tileprint.ts'

interface EncoderPanelProps {
  text: string
  normalizedText: string
  ready: boolean
  creative: boolean
  customized: boolean
  largeCount: number
  smallCount: number
  patternId: string
  summary: string
  sha256: string
  canonicalTiles: readonly TileOrigin[]
  displayTiles: readonly TileOrigin[]
  colors: TileColors
  paints: TileColorMap
  paletteId: string
  swatches?: readonly Swatch[]
  brush: number
  painting: boolean
  display: DisplaySettings
  onText: (value: string) => void
  onCreative: (value: boolean) => void
  onReset: () => void
  onPalette: (id: string) => void
  onColor: (key: keyof TileColors, value: string) => void
  onBrush: (number: number) => void
  onPaintMode: (painting: boolean) => void
  onRandomizePalette: () => void
  onEvenSpread: () => void
  onRandomizeFamilies: (ids: readonly string[]) => void
  onDisplay: (patch: Partial<DisplaySettings>) => void
}

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270]

function Toggle({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 py-1 text-left"
    >
      <span className="text-sm">{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full ${pressed ? 'bg-ink' : 'bg-line'}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-panel ${
            pressed ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className={`block ${disabled ? 'opacity-40' : ''}`}>
      <span className="mb-2 flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export function EncoderPanel({
  text,
  normalizedText,
  ready,
  creative,
  customized,
  largeCount,
  smallCount,
  patternId,
  summary,
  sha256,
  canonicalTiles,
  displayTiles,
  colors,
  paints,
  paletteId,
  swatches,
  brush,
  painting,
  display,
  onText,
  onCreative,
  onReset,
  onPalette,
  onColor,
  onBrush,
  onPaintMode,
  onRandomizePalette,
  onEvenSpread,
  onRandomizeFamilies,
  onDisplay,
}: EncoderPanelProps) {
  const [exportError, setExportError] = useState('')

  function svgMarkup() {
    return buildSvgString({
      tiles: displayTiles,
      colors,
      display,
      paints,
      paletteId,
      title: `${normalizedText || 'Untitled'} · ${patternId}`,
    })
  }

  function exportSvg() {
    if (!ready) return
    setExportError('')
    downloadText(
      artworkFilename(normalizedText, patternId, 'svg'),
      svgMarkup(),
      'image/svg+xml;charset=utf-8',
    )
  }

  function exportJson() {
    if (!ready) return
    setExportError('')
    downloadText(
      artworkFilename(normalizedText, patternId, 'json'),
      serializeExportJson({
        originalText: text,
        normalizedText,
        sha256,
        canonicalTiles,
        displayTiles,
        colors,
        paletteId,
        tileColors: paints,
        display,
      }),
      'application/json;charset=utf-8',
    )
  }

  async function exportImage() {
    if (!ready) return
    setExportError('')
    try {
      await exportPng(svgMarkup(), artworkFilename(normalizedText, patternId, 'png'))
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : 'PNG export failed.')
    }
  }

  return (
    <div className="space-y-8 px-6 py-7 sm:px-7">
      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Message</h2>
        <label className="block">
          <span className="sr-only">Name, place, or title</span>
          <input
            value={text}
            onChange={(event) => onText(event.target.value)}
            placeholder="A name, place, or title"
            spellCheck={false}
            autoCapitalize="characters"
            autoCorrect="off"
            className="w-full border-b border-line bg-transparent py-2 font-serif text-4xl leading-none tracking-tight text-ink outline-none placeholder:text-faint/80 focus:border-ink"
          />
        </label>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {ready ? (
            <>
              Fingerprint of <span className="text-ink">{normalizedText}</span>
            </>
          ) : text.trim() ? (
            'Generating the fingerprint.'
          ) : (
            'Enter a name, place, or title.'
          )}
        </p>
      </section>

      <PatternInfo
        rows={[
          { label: 'Original', value: ready ? text.trim() : '—' },
          { label: 'Normalized', value: ready ? normalizedText : '—' },
          { label: 'Large tiles', value: ready ? String(largeCount) : '—' },
          { label: 'Small tiles', value: ready ? String(smallCount) : '—' },
          { label: 'Encoding', value: 'Tileprint v3' },
          { label: 'Identifier', value: ready ? patternId : '—', mono: true },
          { label: 'Sheet', value: ready ? (customized ? 'Customized' : 'Canonical') : '—' },
        ]}
        note={
          ready
            ? `${summary} The fingerprint is the tile arrangement. It cannot be reversed to recover the message.`
            : text.trim()
              ? 'Generating the fingerprint.'
              : 'Each message has one geometric fingerprint.'
        }
      />

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Tiles</h2>
          {customized ? <span className="text-xs tracking-wide text-muted">Customized</span> : null}
        </div>
        <p className="text-sm leading-relaxed text-muted">
          The fingerprint uses 4 to 7 large tiles. Creative mode moves the tiles on screen and leaves
          that fingerprint unchanged.
        </p>
        <button
          type="button"
          aria-pressed={creative}
          onClick={() => onCreative(!creative)}
          className={`mt-4 w-full rounded-full border px-4 py-2.5 text-sm ${
            creative ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink/40'
          }`}
        >
          {creative ? 'Creative mode on' : 'Creative mode'}
        </button>
        {creative ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Click a large tile to divide it. Click a marked region to join four small tiles. A sheet cannot
            hold more than 7 large tiles.
          </p>
        ) : null}
        {creative || customized ? (
          <button
            type="button"
            onClick={onReset}
            className="mt-3 inline-flex items-center gap-2 text-sm text-ink underline decoration-line underline-offset-4"
          >
            <RotateCcw size={15} strokeWidth={1.75} />
            Reset to fingerprint
          </button>
        ) : null}
      </section>

      <ColorControls
        paletteId={paletteId}
        colors={colors}
        swatches={swatches}
        paints={paints}
        brush={brush}
        painting={painting}
        onPalette={onPalette}
        onColor={onColor}
        onBrush={onBrush}
        onPaintMode={onPaintMode}
        onRandomizePalette={onRandomizePalette}
        onEvenSpread={onEvenSpread}
        onRandomizeFamilies={onRandomizeFamilies}
      />

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Display</h2>
        <p className="mb-3 text-sm text-muted">Rotation changes the view, not the fingerprint.</p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Rotation">
          {ROTATIONS.map((rotation) => {
            const selected = display.rotation === rotation
            return (
              <button
                key={rotation}
                type="button"
                aria-pressed={selected}
                onClick={() => onDisplay({ rotation })}
                className={`rounded-full border py-2 text-sm ${
                  selected ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink/40'
                }`}
              >
                {rotation}°
              </button>
            )
          })}
        </div>
        <div className="mt-4 space-y-1">
          <Toggle
            pressed={display.showNumbers}
            label="Show color numbers"
            onClick={() => onDisplay({ showNumbers: !display.showNumbers })}
          />
          <Toggle
            pressed={display.outlines}
            label="Tile outlines"
            onClick={() => onDisplay({ outlines: !display.outlines })}
          />
          <Toggle
            pressed={display.frame}
            label="Frame preview"
            onClick={() => onDisplay({ frame: !display.frame })}
          />
        </div>
        <div className="mt-4 space-y-4">
          <Slider
            label="Spacing"
            min={0}
            max={22}
            step={1}
            value={display.gap}
            onChange={(gap) => onDisplay({ gap })}
          />
          <Slider
            label="Outline thickness"
            min={0.5}
            max={8}
            step={0.5}
            value={display.outlineWidth}
            disabled={!display.outlines}
            onChange={(outlineWidth) => onDisplay({ outlineWidth })}
          />
        </div>
        <label
          className={`mt-4 flex items-center justify-between gap-3 text-sm ${display.outlines ? '' : 'opacity-40'}`}
        >
          <span className="text-muted">Outline color</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs">{display.outlineColor}</span>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(display.outlineColor) ? display.outlineColor : '#2a2622'}
              disabled={!display.outlines}
              aria-label="Outline color"
              onChange={(event) => onDisplay({ outlineColor: event.target.value.toLowerCase() })}
              className="h-9 w-9 cursor-pointer border border-line disabled:cursor-default"
            />
          </span>
        </label>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Export</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={exportSvg}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm hover:border-ink/40 disabled:cursor-default disabled:opacity-40"
          >
            <Download size={15} strokeWidth={1.75} />
            SVG
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => void exportImage()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm hover:border-ink/40 disabled:cursor-default disabled:opacity-40"
          >
            <ImageDown size={15} strokeWidth={1.75} />
            PNG
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={exportJson}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm hover:border-ink/40 disabled:cursor-default disabled:opacity-40"
          >
            <Braces size={15} strokeWidth={1.75} />
            JSON
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">
          PNG exports at 3000 pixels. Numbers appear in SVG and PNG only while Show color numbers is on. JSON stores the v3 fingerprint, the palette, and each tile color.
        </p>
        {exportError ? <p className="mt-2 text-sm text-ink">{exportError}</p> : null}
      </section>
    </div>
  )
}
