import { useState } from 'react'
import { PALETTES, swatchInk, swatchNumber, tantPalettes } from '../config/palettes.ts'
import type { Swatch } from '../config/palettes.ts'
import type { TileColorMap, TileColors } from '../types/tileprint.ts'

interface ColorControlsProps {
  paletteId: string
  colors: TileColors
  swatches?: readonly Swatch[]
  paints: TileColorMap
  brush: number
  painting: boolean
  onPalette: (id: string) => void
  onColor: (key: keyof TileColors, value: string) => void
  onBrush: (number: number) => void
  onPaintMode: (painting: boolean) => void
  onRandomizePalette: () => void
  onEvenSpread: () => void
  onRandomizeFamilies: (ids: readonly string[]) => void
}

function normalizeHex(input: string): string | null {
  const value = input.trim()
  const short = /^#([\da-fA-F]{3})$/.exec(value)
  const digits = short?.[1]
  if (digits?.length === 3) {
    const red = digits[0]
    const green = digits[1]
    const blue = digits[2]
    if (red && green && blue) {
      return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase()
    }
  }
  if (/^#[\da-fA-F]{6}$/.test(value)) return value.toLowerCase()
  return null
}

function HexField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (value !== source) {
    setSource(value)
    setDraft(value)
  }

  return (
    <label className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-3">
      <span className="text-sm text-muted">{label}</span>
      <input
        value={draft}
        spellCheck={false}
        autoComplete="off"
        aria-label={`${label} hex color`}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          const hex = normalizeHex(next)
          if (hex) onChange(hex)
        }}
        onBlur={() => setDraft(value)}
        className="min-w-0 border-b border-line bg-transparent py-1 font-mono text-sm outline-none focus:border-ink"
      />
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#d8c7b4'}
        aria-label={`${label} color picker`}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
        className="h-9 w-9 cursor-pointer border border-line"
      />
    </label>
  )
}

export function ColorControls({
  paletteId,
  colors,
  swatches,
  paints,
  brush,
  painting,
  onPalette,
  onColor,
  onBrush,
  onPaintMode,
  onRandomizePalette,
  onEvenSpread,
  onRandomizeFamilies,
}: ColorControlsProps) {
  const families = tantPalettes()
  const [familyIds, setFamilyIds] = useState(() => families.map((palette) => palette.id))
  const outside = swatches
    ? [colors.small, colors.large, ...Object.values(paints)].filter(
        (hex) => swatchNumber(paletteId, hex) === null,
      )
    : []
  const custom = outside.some(
    (hex) => !families.some((palette) => swatchNumber(palette.id, hex) !== null),
  )
  const otherFamily = outside.some((hex) =>
    families.some((palette) => palette.id !== paletteId && swatchNumber(palette.id, hex) !== null),
  )

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Color</h2>
      <div className="grid grid-cols-2 gap-2">
        {PALETTES.map((palette) => {
          const selected = palette.id === paletteId
          return (
            <button
              key={palette.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPalette(palette.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-left text-sm ${
                selected
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-transparent text-ink hover:border-ink/40'
              }`}
            >
              <span className="flex shrink-0" aria-hidden="true">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: palette.colors.small }}
                />
                <span
                  className="-ml-1 h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: palette.colors.large }}
                />
              </span>
              <span className="truncate">{palette.name}</span>
            </button>
          )
        })}
      </div>
      {swatches ? (
        <div className="mt-4">
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Palette swatches">
            {swatches.map((swatch) => {
              const selected = brush === swatch.number
              return (
                <button
                  key={swatch.number}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Swatch ${swatch.number}`}
                  onClick={() => onBrush(swatch.number)}
                  className={`flex aspect-square items-center justify-center rounded-md text-xs font-medium ${
                    selected ? 'outline outline-2 outline-offset-2 outline-ink' : ''
                  }`}
                  style={{ backgroundColor: swatch.hex, color: swatchInk(swatch.hex) }}
                >
                  {swatch.number}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            aria-pressed={painting}
            onClick={() => onPaintMode(!painting)}
            className={`mt-3 w-full rounded-full border px-4 py-2.5 text-sm ${
              painting ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink/40'
            }`}
          >
            {painting ? 'Paint tiles on' : 'Paint tiles'}
          </button>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {painting
              ? `Click a tile to color it with swatch ${brush}. A large tile takes one color.`
              : 'Choose a numbered swatch, then paint individual tiles.'}
          </p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={onRandomizePalette}
              className="w-full rounded-full border border-line px-4 py-2.5 text-sm text-ink hover:border-ink/40"
            >
              Randomize palette
            </button>
            <button
              type="button"
              onClick={onEvenSpread}
              className="w-full rounded-full border border-line px-4 py-2.5 text-sm text-ink hover:border-ink/40"
            >
              Even spread
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Randomize palette places this family’s swatches freely. Even spread uses each of the
            twelve as equally as the sheet allows.
          </p>
          <div className="mt-4" role="group" aria-label="TANT families to mix">
            <div className="flex flex-wrap gap-1.5">
              {families.map((palette) => {
                const checked = familyIds.includes(palette.id)
                const short = palette.name.replace('TANT ', '')
                return (
                  <button
                    key={palette.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() =>
                      setFamilyIds((current) =>
                        current.includes(palette.id)
                          ? current.filter((id) => id !== palette.id)
                          : [...current, palette.id],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs ${
                      checked ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink/40'
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => onRandomizeFamilies(familyIds)}
              disabled={familyIds.length === 0}
              className="mt-2 w-full rounded-full border border-line px-4 py-2.5 text-sm text-ink hover:border-ink/40 disabled:cursor-default disabled:opacity-40"
            >
              Randomize families
            </button>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Each tile draws a swatch from the families you check. A color from another family has
              no number in this palette.
            </p>
          </div>
          {otherFamily ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Some tiles use another TANT family, so they have no number here.
            </p>
          ) : null}
          {custom ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              A custom color is not in a TANT palette, so it has no number.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 space-y-2.5">
        <HexField label="Small" value={colors.small} onChange={(value) => onColor('small', value)} />
        <HexField label="Large" value={colors.large} onChange={(value) => onColor('large', value)} />
        <HexField
          label="Paper"
          value={colors.background}
          onChange={(value) => onColor('background', value)}
        />
      </div>
    </section>
  )
}
