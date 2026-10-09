import { useEffect, useRef } from 'react'
import type { DifferenceCoarray } from '../lib/coarray'
import type { Heatmap } from '../lib/pattern'

export interface Series {
  name: string
  color: string
  db: Float64Array
  dashed?: boolean
  width?: number
}

const DB_MIN = -60
const clampDb = (v: number) => Math.max(DB_MIN, Math.min(0, v))

/** Downsample indices so SVG paths stay small. */
function indices(n: number, max = 900): number[] {
  const step = Math.max(1, Math.floor((n - 1) / max))
  const out: number[] = []
  for (let i = 0; i < n; i += step) out.push(i)
  if (out[out.length - 1] !== n - 1) out.push(n - 1)
  return out
}

interface CartesianProps {
  theta: Float64Array
  series: Series[]
  /** vertical markers (degrees) */
  steer?: number
  gratings?: number[]
  svgId?: string
}

export function CartesianPlot({ theta, series, steer, gratings = [], svgId }: CartesianProps) {
  const W = 640
  const H = 300
  const m = { l: 44, r: 12, t: 10, b: 32 }
  const x = (t: number) => m.l + ((t + 90) / 180) * (W - m.l - m.r)
  const y = (d: number) => m.t + (-clampDb(d) / -DB_MIN) * (H - m.t - m.b)
  const idx = indices(theta.length)
  return (
    <svg id={svgId} viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="Array pattern in dB versus angle from broadside" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width={W} height={H} className="plot-bg" />
      {[0, -10, -20, -30, -40, -50, -60].map((d) => (
        <g key={d}>
          <line x1={m.l} x2={W - m.r} y1={y(d)} y2={y(d)} className="grid" />
          <text x={m.l - 6} y={y(d) + 4} textAnchor="end" className="tick">{d}</text>
        </g>
      ))}
      {[-90, -60, -30, 0, 30, 60, 90].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} className="grid" />
          <text x={x(t)} y={H - m.b + 16} textAnchor="middle" className="tick">{t}°</text>
        </g>
      ))}
      <text x={W / 2} y={H - 4} textAnchor="middle" className="tick">angle from broadside</text>
      <text x="12" y={H / 2} className="tick" transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">dB</text>
      {gratings.map((g) => (
        <line key={g} x1={x(g)} x2={x(g)} y1={m.t} y2={H - m.b} className="grating" />
      ))}
      {steer !== undefined && <line x1={x(steer)} x2={x(steer)} y1={m.t} y2={H - m.b} className="steer" />}
      {series.map((s) => (
        <path
          key={s.name}
          d={idx.map((i, k) => `${k ? 'L' : 'M'}${x(theta[i]).toFixed(1)} ${y(s.db[i]).toFixed(1)}`).join('')}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 1.6}
          strokeDasharray={s.dashed ? '5 3' : undefined}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export function PolarPlot({ theta, series }: { theta: Float64Array; series: Series[] }) {
  const R = 170
  const cx = 200
  const cy = 190
  const idx = indices(theta.length)
  const pt = (t: number, d: number) => {
    const r = ((clampDb(d) - DB_MIN) / -DB_MIN) * R
    const a = (t * Math.PI) / 180
    return `${(cx + r * Math.sin(a)).toFixed(1)} ${(cy - r * Math.cos(a)).toFixed(1)}`
  }
  return (
    <svg viewBox="0 0 400 210" className="plot" role="img" aria-label="Polar array pattern" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="400" height="210" className="plot-bg" />
      {[0, -10, -20, -30, -40, -50].map((d) => {
        const r = ((d - DB_MIN) / -DB_MIN) * R
        return (
          <g key={d}>
            <path d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}`} className="grid" fill="none" />
            <text x={cx + 3} y={cy - r + 11} className="tick">{d}</text>
          </g>
        )
      })}
      {[-90, -60, -30, 0, 30, 60, 90].map((t) => (
        <g key={t}>
          <line x1={cx} y1={cy} x2={cx + R * Math.sin((t * Math.PI) / 180)} y2={cy - R * Math.cos((t * Math.PI) / 180)} className="grid" />
          <text
            x={cx + (R + 12) * Math.sin((t * Math.PI) / 180)}
            y={cy - (R + 12) * Math.cos((t * Math.PI) / 180) + (Math.abs(t) === 90 ? 14 : 3)}
            textAnchor="middle"
            className="tick"
          >
            {t}°
          </text>
        </g>
      ))}
      {series.map((s) => (
        <path
          key={s.name}
          d={idx.map((i, k) => `${k ? 'L' : 'M'}${pt(theta[i], s.db[i])}`).join('')}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 1.6}
          strokeDasharray={s.dashed ? '5 3' : undefined}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.name}>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '5 3' : undefined} />
          </svg>
          {s.name}
        </span>
      ))}
    </div>
  )
}

/** Element positions on an axis, one row per array. */
export function ElementStrip({ rows }: { rows: { name: string; marks: number[]; color: string }[] }) {
  const W = 640
  const pad = 14
  const max = Math.max(1, ...rows.flatMap((r) => r.marks))
  const rowH = 26
  const H = rows.length * rowH + 14
  const x = (m: number) => pad + (m / max) * (W - 2 * pad)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="Element positions" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width={W} height={H} className="plot-bg" />
      {rows.map((r, i) => {
        const cy = 12 + i * rowH + 6
        const dense = r.marks.length > 120
        return (
          <g key={r.name}>
            <line x1={pad} x2={W - pad} y1={cy} y2={cy} className="grid" />
            {r.marks.map((m) => (dense ? <line key={m} x1={x(m)} x2={x(m)} y1={cy - 7} y2={cy + 7} stroke={r.color} strokeWidth="1" /> : <circle key={m} cx={x(m)} cy={cy} r="4.5" fill={r.color} />))}
            <text x={pad} y={cy - 9} className="tick">{r.name}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Lag histogram: green = measured once, amber = redundant, red = missing. */
export function CoarrayPlot({ co }: { co: DifferenceCoarray }) {
  const W = 640
  const H = 150
  const m = { l: 30, r: 8, t: 8, b: 22 }
  const L = Math.max(1, co.aperture)
  const maxMult = Math.max(1, ...co.multiplicity)
  const bw = (W - m.l - m.r) / (L + 1)
  const x = (d: number) => m.l + d * bw
  const ph = H - m.t - m.b
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="plot" role="img" aria-label="Co-array lag coverage" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width={W} height={H} className="plot-bg" />
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="grid" />
      {co.multiplicity.map((c, d) => {
        if (d === 0) return null
        if (c === 0) return <rect key={d} x={x(d)} y={H - m.b - ph} width={Math.max(bw, 0.6)} height={ph} className="lag-miss" />
        const h = (c / maxMult) * (ph - 6) + 6
        return <rect key={d} x={x(d)} y={H - m.b - h} width={Math.max(bw * 0.8, 0.6)} height={h} className={c === 1 ? 'lag-one' : 'lag-many'} />
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={m.l + f * (W - m.l - m.r)} y={H - 6} textAnchor="middle" className="tick">{Math.round(f * L)}</text>
      ))}
      <text x={m.l - 4} y={m.t + 8} textAnchor="end" className="tick">{maxMult}×</text>
      <text x={m.l - 4} y={H - m.b} textAnchor="end" className="tick">0</text>
    </svg>
  )
}

/** Pattern of a planar array in the (u, v) direction-cosine plane. */
export function HeatmapCanvas({ map }: { map: Heatmap }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const { size, db } = map
    c.width = size
    c.height = size
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < db.length; i++) {
      const v = db[i]
      if (Number.isNaN(v)) {
        img.data[i * 4 + 3] = 0
        continue
      }
      const t = Math.max(0, Math.min(1, (v - DB_MIN) / -DB_MIN))
      // dark blue -> cyan -> yellow -> red
      const [r, g, b] = ramp(t)
      img.data[i * 4] = r
      img.data[i * 4 + 1] = g
      img.data[i * 4 + 2] = b
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [map])
  return <canvas ref={ref} className="heatmap" role="img" aria-label="Planar array pattern in u-v space, 0 to -60 dB" />
}

function ramp(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [12, 16, 48],
    [30, 90, 170],
    [40, 190, 190],
    [250, 220, 60],
    [230, 50, 40],
  ]
  const f = t * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(f))
  const k = f - i
  return [0, 1, 2].map((c) => Math.round(stops[i][c] + (stops[i + 1][c] - stops[i][c]) * k)) as [number, number, number]
}
