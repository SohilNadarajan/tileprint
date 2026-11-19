interface PatternRow {
  label: string
  value: string
  mono?: boolean
}

interface PatternInfoProps {
  rows: PatternRow[]
  note: string
}

export function PatternInfo({ rows, note }: PatternInfoProps) {
  return (
    <section aria-live="polite">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Pattern</h2>
      <dl className="border-y border-line">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0"
          >
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className={row.mono ? 'font-mono text-xs tracking-wide' : 'text-right text-sm'}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>
    </section>
  )
}
