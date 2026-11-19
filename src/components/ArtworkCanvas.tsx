import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Swatch } from '../config/palettes.ts'
import type { DisplaySettings, TileColorMap, TileColors, TileOrigin } from '../types/tileprint.ts'
import { composeArtwork, hitTest, paintHit, VIEWBOX, type HitTarget, type PaintTarget } from '../lib/render.ts'

interface ArtworkCanvasProps {
  tiles: readonly TileOrigin[]
  colors: TileColors
  display: DisplaySettings
  creative?: boolean
  painting?: boolean
  paints?: TileColorMap
  paletteId?: string
  swatches?: readonly Swatch[]
  label: string
  className?: string
  onSplit?: (origin: TileOrigin) => void
  onMerge?: (origin: TileOrigin) => void
  onPaint?: (target: PaintTarget) => void
}

function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const matrix = svg.getScreenCTM()
  if (!matrix) return null
  const local = point.matrixTransform(matrix.inverse())
  return { x: local.x, y: local.y }
}

export function ArtworkCanvas({
  tiles,
  colors,
  display,
  creative = false,
  painting = false,
  paints,
  paletteId,
  swatches,
  label,
  className,
  onSplit,
  onMerge,
  onPaint,
}: ArtworkCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<HitTarget | null>(null)
  const [paintHover, setPaintHover] = useState<PaintTarget | null>(null)
  const interactive = creative || painting
  const scene = useMemo(
    () =>
      composeArtwork({
        tiles,
        colors,
        display,
        includeHints: creative && !painting,
        paints,
        paletteId,
        swatches,
      }),
    [tiles, colors, display, creative, painting, paints, paletteId, swatches],
  )

  function pointFromEvent(event: MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return null
    return clientToSvg(svg, event.clientX, event.clientY)
  }

  function updateHover(event: MouseEvent<SVGSVGElement>) {
    const point = pointFromEvent(event)
    if (!point) return
    if (painting) {
      setPaintHover(paintHit(scene, point.x, point.y))
      return
    }
    setHover(hitTest(scene, point.x, point.y))
  }

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    const point = pointFromEvent(event)
    if (!point) return
    if (painting) {
      const hit = paintHit(scene, point.x, point.y)
      if (hit) onPaint?.(hit)
      setPaintHover(null)
      return
    }
    const hit = hitTest(scene, point.x, point.y)
    if (!hit) {
      setHover(null)
      return
    }
    if (hit.kind === 'split') onSplit?.(hit.origin)
    else onMerge?.(hit.origin)
    setHover(null)
  }

  const paintTile = paintHover
    ? (paintHover.kind === 'large' ? scene.largeTiles : scene.smallTiles).find(
        (tile) => tile.origin?.row === paintHover.origin.row && tile.origin.col === paintHover.origin.col,
      )
    : undefined

  const hoverTile =
    hover?.kind === 'merge'
      ? scene.hints.find(
          (hint) => hint.origin?.row === hover.origin.row && hint.origin.col === hover.origin.col,
        )
      : hover?.kind === 'split'
        ? scene.largeTiles.find(
            (tile) => tile.origin?.row === hover.origin.row && tile.origin.col === hover.origin.col,
          )
        : undefined

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      role={interactive ? 'group' : 'img'}
      aria-label={label}
      className={className}
      shapeRendering="geometricPrecision"
      pointerEvents={interactive ? 'all' : 'none'}
      style={{ cursor: interactive && (painting ? paintHover : hover) ? 'pointer' : 'default' }}
      onMouseMove={interactive ? updateHover : undefined}
      onMouseLeave={
        interactive
          ? () => {
              setHover(null)
              setPaintHover(null)
            }
          : undefined
      }
      onClick={interactive ? handleClick : undefined}
    >
      {scene.commands.map((command) =>
        command.type === 'circle' ? (
          <circle
            key={command.id}
            cx={command.cx}
            cy={command.cy}
            r={command.r}
            fill={command.fill}
            fillOpacity={command.fillOpacity}
            pointerEvents="none"
          />
        ) : command.type === 'text' ? (
          <text
            key={command.id}
            x={command.x}
            y={command.y}
            fill={command.fill}
            fontSize={command.fontSize}
            textAnchor="middle"
            dominantBaseline="central"
            pointerEvents="none"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            {command.text}
          </text>
        ) : (
          <rect
            key={command.id}
            x={command.x}
            y={command.y}
            width={command.w}
            height={command.h}
            fill={command.fill}
            fillOpacity={command.fillOpacity}
            stroke={command.stroke}
            strokeWidth={command.strokeWidth}
            strokeDasharray={command.strokeDasharray}
            strokeOpacity={command.strokeOpacity}
            pointerEvents="none"
          />
        ),
      )}
      {hoverTile && hover?.kind === 'merge' ? (
        <rect
          x={hoverTile.x}
          y={hoverTile.y}
          width={hoverTile.w}
          height={hoverTile.h}
          fill={colors.large}
          fillOpacity={0.16}
          stroke={colors.large}
          strokeWidth={2.5}
          strokeDasharray="8 6"
          pointerEvents="none"
        />
      ) : null}
      {paintTile ? (
        <rect
          x={paintTile.x}
          y={paintTile.y}
          width={paintTile.w}
          height={paintTile.h}
          fill="#ffffff"
          fillOpacity={0.18}
          stroke={colors.background}
          strokeWidth={3}
          pointerEvents="none"
        />
      ) : null}
      {hoverTile && hover?.kind === 'split' ? (
        <rect
          x={hoverTile.x}
          y={hoverTile.y}
          width={hoverTile.w}
          height={hoverTile.h}
          fill="#ffffff"
          fillOpacity={0.2}
          stroke={colors.background}
          strokeWidth={3}
          pointerEvents="none"
        />
      ) : null}
    </svg>
  )
}
