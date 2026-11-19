import { RotateCcw, RotateCw } from 'lucide-react'
import type { Comparison } from '../lib/fingerprint.ts'

interface DecoderPanelProps {
  message: string
  largeCount: number
  canUndo: boolean
  result: Comparison | null
  pending: boolean
  onMessage: (value: string) => void
  onUndo: () => void
  onReset: () => void
  onRotate: () => void
  onCompare: () => void
}

export function DecoderPanel({
  message,
  largeCount,
  canUndo,
  result,
  pending,
  onMessage,
  onUndo,
  onReset,
  onRotate,
  onCompare,
}: DecoderPanelProps) {
  const ready = message.trim().length > 0
  return (
    <div className="space-y-8 px-6 py-7 sm:px-7">
      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">
          Candidate
        </h2>
        <label className="block">
          <span className="sr-only">Candidate name or message</span>
          <input
            value={message}
            onChange={(event) => onMessage(event.target.value)}
            placeholder="A name, place, or title"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="w-full border-b border-line bg-transparent py-2 font-serif text-3xl leading-none tracking-tight text-ink outline-none placeholder:text-faint/80 focus:border-ink"
          />
        </label>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Rebuild the sheet beside this name. Tileprint compares the canonical arrangements, so a
          rotated sheet still matches. A fingerprint cannot be reversed to recover the original message.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">
          Reconstruct
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Start from a sheet of small tiles. Click a 2×2 region to place a large tile, or click a large
          tile to remove it. Colors and borders are ignored.
        </p>
        <p className="mt-4 font-serif text-3xl tracking-tight">
          {largeCount} <span className="text-lg text-muted">large tiles</span>
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-full border border-line px-3 py-2 text-sm hover:border-ink/40 disabled:cursor-default disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm hover:border-ink/40"
        >
          <RotateCcw size={15} strokeWidth={1.75} />
          Reset
        </button>
        <button
          type="button"
          onClick={onRotate}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm hover:border-ink/40"
        >
          <RotateCw size={15} strokeWidth={1.75} />
          90°
        </button>
      </section>

      <section>
        <button
          type="button"
          onClick={onCompare}
          disabled={!ready || pending}
          className="w-full rounded-full bg-ink px-4 py-3 text-sm text-paper disabled:cursor-default disabled:opacity-40"
        >
          {pending ? 'Comparing' : 'Compare'}
        </button>
        {result ? (
          <div className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Result</p>
            <p className="mt-2 font-serif text-5xl tracking-tight">{result.label}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{result.detail}</p>
            {result.patternId ? (
              <p className="mt-3 font-mono text-xs tracking-wide text-muted">{result.patternId}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
