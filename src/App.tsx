import { useEffect, useMemo, useState } from 'react'
import { CartesianPlot, CoarrayPlot, ElementStrip, HeatmapCanvas, Legend, PolarPlot, type Series } from './components/Plots'
import { differenceCoarray, sumCoarray } from './lib/coarray'
import { patternCsv, positionsCsv } from './lib/exportCsv'
import { OGR, OGR_LENGTH, isGolomb } from './lib/golomb'
import { gratingLobes, type ElementModel, linearPattern, patternMetrics, planarPattern, ulaMarks, wavelengthMm, type Metrics, type Pattern } from './lib/pattern'
import { DEFAULTS, clamp, loadSettings, parseMarks, resolveMarks, saveSettings, type Settings } from './model'
import { useSearch } from './useSearch'

const BLUE = '#2563eb'
const AMBER = '#d97706'
const GREEN = '#16a34a'

interface Analysis {
  marks: number[]
  pat: Pattern
  met: Metrics
  gratings: number[]
  ulaN: { pat: Pattern; met: Metrics; gratings: number[] }
  ulaA: { pat: Pattern; met: Metrics; gratings: number[] }
}

function analyze(marks: number[], d: number, steer: number, el: ElementModel): Analysis {
  const make = (m: number[]) => {
    const pat = linearPattern(m.map((x) => x * d), steer, el)
    return { pat, met: patternMetrics(pat, steer), gratings: gratingLobes(m, d, steer) }
  }
  const L = marks[marks.length - 1]
  return { marks, ...make(marks), ulaN: make(ulaMarks(marks.length)), ulaA: make(ulaMarks(L + 1)) }
}

const fmt = (v: number | null, unit = '°', digits = 2) => (v === null ? '—' : `${v.toFixed(digits)}${unit}`)

function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Num({ value, onChange, min, max, step, id, width }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; id?: string; width?: string }) {
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      style={{ width }}
      onChange={(e) => {
        const v = e.target.valueAsNumber
        if (Number.isFinite(v)) onChange(v)
      }}
      onBlur={(e) => {
        const v = e.target.valueAsNumber
        if (Number.isFinite(v)) onChange(clamp(v, min, max))
      }}
    />
  )
}

const PRESETS: { name: string; patch: Partial<Settings> }[] = [
  { name: 'OGR-6 (length 17)', patch: { mode: 'ogr', ogrN: 6, planar: false } },
  { name: 'OGR-10 (length 55)', patch: { mode: 'ogr', ogrN: 10, planar: false } },
  { name: 'OGR-16 (length 177)', patch: { mode: 'ogr', ogrN: 16, planar: false } },
  { name: 'Wichmann sparse, L=22', patch: { mode: 'sparse', sparseL: 22, planar: false } },
  { name: 'Sparse L=60', patch: { mode: 'sparse', sparseL: 60, planar: false } },
  { name: 'Planar OGR-5 × OGR-5', patch: { mode: 'ogr', ogrN: 5, yOgrN: 5, planar: true, spacing: 0.5 } },
]

export default function App() {
  const [s, setS] = useState<Settings>(loadSettings)
  const [view, setView] = useState<'cartesian' | 'polar'>('cartesian')
  const set = (patch: Partial<Settings>) => setS((p) => ({ ...p, ...patch }))
  useEffect(() => saveSettings(s), [s])

  const search = useSearch((req, marks, ms) => {
    if (req.kind === 'sparse-exact') set({ foundSparse: { length: req.length, marks, ms }, mode: 'sparse' })
    else set({ foundGolomb: { n: req.n, marks, method: req.kind === 'golomb-exact' ? 'exact' : 'heuristic', ms }, mode: 'golomb' })
  })

  const spacing = clamp(s.spacing, 0.05, 4)
  const freqHz = Math.max(1e-3, s.freq) * (s.unit === 'GHz' ? 1e9 : 1e6)
  const lambdaMm = wavelengthMm(freqHz)
  const dMm = spacing * lambdaMm

  const { mode, ogrN, sparseL, customText, foundGolomb, foundSparse } = s
  const resolved = useMemo(() => resolveMarks({ mode, ogrN, sparseL, customText, foundGolomb, foundSparse }), [mode, ogrN, sparseL, customText, foundGolomb, foundSparse])
  const el = useMemo<ElementModel>(() => ({ kind: s.element, q: s.patchQ }), [s.element, s.patchQ])
  const marks = resolved.marks
  const steer = clamp(s.steer, -90, 90)
  const steerY = clamp(s.steerY, -90, 90)

  const a = useMemo(
    () => (marks ? analyze(marks, spacing, steer, el) : null),
    [marks, spacing, steer, el],
  )
  const marksY = s.planar ? (s.yOgrN >= 2 ? OGR[clamp(s.yOgrN, 2, 28)] : marks) : null
  const ay = useMemo(
    () => (marksY ? analyze(marksY, spacing, steerY, el) : null),
    [marksY, spacing, steerY, el],
  )
  const heat = useMemo(() => {
    if (!marks || !marksY) return null
    return planarPattern(marks.map((m) => m * spacing), marksY.map((m) => m * spacing), steer, steerY, el)
  }, [marks, marksY, spacing, steer, steerY, el])
  const co = useMemo(() => (marks ? differenceCoarray(marks) : null), [marks])
  const virt = useMemo(() => (marks ? sumCoarray(marks, marks) : null), [marks])

  const L = marks ? marks[marks.length - 1] : 0
  const golomb = marks ? isGolomb(marks) : false
  const series: Series[] = a
    ? [
        { name: 'Ruler array', color: BLUE, db: a.pat.db, width: 2 },
        ...(s.showUlaN ? [{ name: `ULA, same N (${marks!.length})`, color: AMBER, db: a.ulaN.pat.db, dashed: true }] : []),
        ...(s.showUlaAperture ? [{ name: `ULA, same aperture (${L + 1})`, color: GREEN, db: a.ulaA.pat.db, dashed: true }] : []),
      ]
    : []

  const searchBusy = search.state.running
  const exportBase = (resolved.label || 'array').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const rows: { name: string; color: string; elements: number; aperture: number; m: Metrics; g: number[] }[] = a
    ? [
        { name: 'Ruler array', color: BLUE, elements: marks!.length, aperture: L, m: a.met, g: a.gratings },
        { name: 'ULA, same N', color: AMBER, elements: marks!.length, aperture: marks!.length - 1, m: a.ulaN.met, g: a.ulaN.gratings },
        { name: 'ULA, same aperture', color: GREEN, elements: L + 1, aperture: L, m: a.ulaA.met, g: a.ulaA.gratings },
      ]
    : []

  const custom = parseMarks(s.customText)

  return (
    <div className="app">
      <header>
        <h1>Sparse Array Designer</h1>
        <p>
          Design linear and planar antenna arrays from Golomb and sparse rulers. See the radiation pattern, beamwidth, sidelobes, grating lobes and the co-array, and compare with filled arrays.
        </p>
      </header>

      <div className="presets" aria-label="Examples">
        {PRESETS.map((p) => (
          <button key={p.name} className="chip" onClick={() => set(p.patch)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="layout">
        <aside className="controls">
          <section className="card">
            <h2>Ruler</h2>
            <div className="tabs" role="tablist">
              {([['ogr', 'Known Golomb'], ['golomb', 'Golomb search'], ['sparse', 'Sparse ruler'], ['custom', 'Custom']] as const).map(([m, label]) => (
                <button key={m} role="tab" aria-selected={s.mode === m} className={s.mode === m ? 'tab on' : 'tab'} onClick={() => set({ mode: m })}>
                  {label}
                </button>
              ))}
            </div>

            {s.mode === 'ogr' && (
              <div className="field">
                <label htmlFor="ogr">Marks n = {clamp(s.ogrN, 2, 28)}</label>
                <input id="ogr" type="range" min={2} max={28} value={clamp(s.ogrN, 2, 28)} onChange={(e) => set({ ogrN: +e.target.value })} />
                <small>Optimal length {OGR_LENGTH[clamp(s.ogrN, 2, 28)]}. Table of proven optimal rulers up to 28 marks (OGR-28: distributed.net, 2022).</small>
              </div>
            )}

            {s.mode === 'golomb' && (
              <div className="field">
                <label htmlFor="sn">Number of marks n</label>
                <Num id="sn" value={s.searchN} min={3} max={40} onChange={(v) => set({ searchN: Math.round(v) })} width="5rem" />
                <small>
                  {s.searchN <= 12
                    ? `Exact branch and bound in a Web Worker. Proves optimality${s.searchN === 12 ? ' (n = 12 takes a few minutes)' : s.searchN === 11 ? ' (n = 11 takes several seconds)' : ''}.`
                    : 'Algebraic construction (Ruzsa, Erdős–Turán) plus local search for 1.5 s. Near-optimal, not proven.'}
                </small>
                <div className="row">
                  <button
                    className="btn primary"
                    disabled={searchBusy}
                    onClick={() => {
                      const n = clamp(Math.round(s.searchN), 3, 40)
                      search.run(n <= 12 ? { kind: 'golomb-exact', n } : { kind: 'golomb-heuristic', n, ms: 1500 })
                    }}
                  >
                    {searchBusy ? 'Searching…' : 'Search'}
                  </button>
                  {searchBusy && <button className="btn" onClick={search.cancel}>Cancel</button>}
                </div>
                {searchBusy && <small>{search.state.nodes ? `${(search.state.nodes / 1e6).toFixed(0)} M nodes, trying length ${search.state.length}` : 'Running…'}</small>}
                {s.foundGolomb && !searchBusy && (
                  <small>
                    Found n={s.foundGolomb.n}, length {s.foundGolomb.marks[s.foundGolomb.n - 1]} in {s.foundGolomb.ms} ms
                    {OGR_LENGTH[s.foundGolomb.n] !== undefined && ` (known optimum ${OGR_LENGTH[s.foundGolomb.n]})`}.
                  </small>
                )}
              </div>
            )}

            {s.mode === 'sparse' && (
              <div className="field">
                <label htmlFor="sl">Length L (unit spacings)</label>
                <Num id="sl" value={s.sparseL} min={1} max={300} onChange={(v) => set({ sparseL: Math.round(v) })} width="5rem" />
                <small>A sparse ruler measures every distance 1..L with as few marks as possible. Wichmann construction works for any length.</small>
                <div className="row">
                  <button className="btn" disabled={searchBusy || s.sparseL > 40} onClick={() => search.run({ kind: 'sparse-exact', length: clamp(Math.round(s.sparseL), 1, 40) })}>
                    {searchBusy ? 'Searching…' : 'Find minimum (exact, L ≤ 40)'}
                  </button>
                  {searchBusy && <button className="btn" onClick={search.cancel}>Cancel</button>}
                </div>
              </div>
            )}

            {s.mode === 'custom' && (
              <div className="field">
                <label htmlFor="cm">Mark positions (integers)</label>
                <textarea id="cm" rows={2} value={s.customText} onChange={(e) => set({ customText: e.target.value })} />
                {custom.error && <small className="err">{custom.error}</small>}
              </div>
            )}

            {marks && (
              <div className="ruler-info">
                <b>{resolved.label}</b>: {marks.length} marks, length {L}
                <code>{marks.join(' ')}</code>
                {resolved.note && <small>{resolved.note}</small>}
                <small>{golomb ? 'Golomb: every difference is unique.' : 'Not a Golomb ruler: some differences repeat.'}</small>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Array</h2>
            <div className="field inline">
              <label htmlFor="f">Frequency</label>
              <Num id="f" value={s.freq} min={0.001} max={1000000} step={0.1} onChange={(v) => set({ freq: v })} width="6rem" />
              <select aria-label="Frequency unit" value={s.unit} onChange={(e) => set({ unit: e.target.value as 'MHz' | 'GHz' })}>
                <option>MHz</option>
                <option>GHz</option>
              </select>
            </div>
            <div className="field inline">
              <label htmlFor="d">Unit spacing (λ)</label>
              <Num id="d" value={s.spacing} min={0.05} max={4} step={0.05} onChange={(v) => set({ spacing: v })} width="5rem" />
            </div>
            <small>
              λ = {lambdaMm.toFixed(2)} mm, unit spacing {dMm.toFixed(2)} mm, aperture {(L * dMm).toFixed(1)} mm ({(L * spacing).toFixed(1)} λ).
            </small>
            <div className="field">
              <label htmlFor="st">Steering angle {steer.toFixed(1)}°{s.planar ? ' (x)' : ''}</label>
              <input id="st" type="range" min={-90} max={90} step={0.5} value={steer} onChange={(e) => set({ steer: +e.target.value })} />
            </div>
            <div className="field inline">
              <label htmlFor="el">Element</label>
              <select id="el" value={s.element} onChange={(e) => set({ element: e.target.value as Settings['element'] })}>
                <option value="isotropic">Isotropic</option>
                <option value="dipole">Half-wave dipole</option>
                <option value="patch">Patch, cos^q</option>
              </select>
              {s.element === 'patch' && <Num value={s.patchQ} min={0.5} max={6} step={0.5} onChange={(v) => set({ patchQ: v })} width="4.5rem" />}
            </div>
            {s.element === 'patch' && <small>Power pattern cos^q θ, q = {s.patchQ}.</small>}
            {s.element === 'dipole' && <small>Dipole collinear with the array axis, field cos(π/2 sinθ)/cosθ.</small>}
          </section>

          <section className="card">
            <h2>Compare and 2D</h2>
            <label className="check"><input type="checkbox" checked={s.showUlaN} onChange={(e) => set({ showUlaN: e.target.checked })} /> Filled ULA, same element count</label>
            <label className="check"><input type="checkbox" checked={s.showUlaAperture} onChange={(e) => set({ showUlaAperture: e.target.checked })} /> Filled ULA, same aperture</label>
            <label className="check"><input type="checkbox" checked={s.planar} onChange={(e) => set({ planar: e.target.checked })} /> Planar array (product of two rulers)</label>
            {s.planar && (
              <>
                <div className="field inline">
                  <label htmlFor="yr">Y ruler</label>
                  <select id="yr" value={s.yOgrN >= 2 ? s.yOgrN : 0} onChange={(e) => set({ yOgrN: +e.target.value })}>
                    <option value={0}>Same as X</option>
                    {Array.from({ length: 27 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>OGR-{n}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="sty">Steering y {steerY.toFixed(1)}°</label>
                  <input id="sty" type="range" min={-90} max={90} step={0.5} value={steerY} onChange={(e) => set({ steerY: +e.target.value })} />
                </div>
              </>
            )}
            <button className="btn" onClick={() => setS(DEFAULTS)}>Reset all</button>
          </section>
        </aside>

        <main className="results">
          {!marks || !a || !co || !virt ? (
            <section className="card empty">
              {s.mode === 'golomb' ? 'Run a search to see the array.' : 'Enter a valid ruler to see the array.'}
            </section>
          ) : (
            <>
              {a.gratings.length > 0 && (
                <div className="warn" role="alert">
                  Grating lobe{a.gratings.length > 1 ? 's' : ''} in the visible region at {a.gratings.map((g) => `${g.toFixed(1)}°`).join(', ')}. The unit spacing is too large for this steering angle; use {spacing > 0.5 ? 'a smaller spacing (λ/2 or less)' : 'a smaller steering angle'}.
                </div>
              )}
              {a.gratings.length === 0 && a.met.pslDb !== null && a.met.pslDb > -1 && (
                <div className="warn" role="alert">A sidelobe is within 1 dB of the main beam.</div>
              )}

              <section className="card">
                <div className="card-head">
                  <h2>{s.planar ? 'Pattern, x cut' : 'Radiation pattern'}</h2>
                  <div className="tabs small">
                    <button className={view === 'cartesian' ? 'tab on' : 'tab'} onClick={() => setView('cartesian')}>Cartesian</button>
                    <button className={view === 'polar' ? 'tab on' : 'tab'} onClick={() => setView('polar')}>Polar</button>
                  </div>
                </div>
                {view === 'cartesian' ? (
                  <CartesianPlot theta={a.pat.thetaDeg} series={series} steer={steer} gratings={a.gratings} svgId="pattern-svg" />
                ) : (
                  <PolarPlot theta={a.pat.thetaDeg} series={series} />
                )}
                <Legend series={series} />
                <small>Normalised to each curve's own maximum (the true peak gain of equal-N arrays is the same). Dotted red lines mark grating lobes.</small>
              </section>

              <section className="card">
                <h2>Beam metrics</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th></th><th>Elements</th><th>Aperture</th><th>HPBW</th><th>First null (−/+)</th><th>Peak sidelobe</th><th>Grating lobes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter((r) => r.name === 'Ruler array' || (r.name === 'ULA, same N' && s.showUlaN) || (r.name === 'ULA, same aperture' && s.showUlaAperture))
                        .map((r) => (
                          <tr key={r.name}>
                            <th scope="row"><span className="dot" style={{ background: r.color }} />{r.name}</th>
                            <td>{r.elements}</td>
                            <td>{(r.aperture * spacing).toFixed(1)} λ</td>
                            <td>{fmt(r.m.hpbwDeg)}</td>
                            <td>{fmt(r.m.nullLeftDeg, '°', 2)} / {fmt(r.m.nullRightDeg)}</td>
                            <td>{r.m.pslDb === null ? '—' : `${r.m.pslDb.toFixed(1)} dB`}</td>
                            <td>{r.g.length ? r.g.map((g) => `${g.toFixed(0)}°`).join(', ') : 'none'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <small>HPBW is the −3 dB width of the lobe at the steering angle; for a ULA at broadside it is ≈ 0.886 λ/(N d). Sparse arrays trade a narrow beam for higher sidelobes.</small>
              </section>

              {s.planar && ay && heat && marksY && (
                <section className="card">
                  <h2>Planar array: {marks.length} × {marksY.length} = {marks.length * marksY.length} elements</h2>
                  <div className="planar">
                    <div>
                      <HeatmapCanvas map={heat} />
                      <small>Pattern in direction cosines (u = sin θx, v = sin θy), 0 to −60 dB, u horizontal, v vertical.</small>
                    </div>
                    <div>
                      <CartesianPlot theta={ay.pat.thetaDeg} series={[{ name: 'Y ruler', color: BLUE, db: ay.pat.db, width: 2 }]} steer={steerY} gratings={ay.gratings} />
                      <small>
                        Y cut: HPBW {fmt(ay.met.hpbwDeg)}, peak sidelobe {ay.met.pslDb === null ? '—' : `${ay.met.pslDb.toFixed(1)} dB`}. Y ruler {marksY.join(' ')}.
                      </small>
                    </div>
                  </div>
                  <small>The product array has separable pattern AF(u,v) = AFx(u)·AFy(v); the x cut above and this y cut are its factors.</small>
                </section>
              )}

              <section className="card">
                <h2>Elements</h2>
                <ElementStrip
                  rows={[
                    { name: 'Ruler array', marks, color: BLUE },
                    ...(s.showUlaN ? [{ name: 'ULA, same N', marks: ulaMarks(marks.length), color: AMBER }] : []),
                    ...(s.showUlaAperture && L <= 400 ? [{ name: 'ULA, same aperture', marks: ulaMarks(L + 1), color: GREEN }] : []),
                  ]}
                />
              </section>

              <section className="card">
                <h2>Co-array (difference set)</h2>
                <CoarrayPlot co={co} />
                <div className="stats">
                  <div><b>{co.distinct}</b><span>of {co.aperture} lags measured</span></div>
                  <div><b>{co.holes.length}</b><span>holes</span></div>
                  <div><b>{co.redundancy.toFixed(2)}</b><span>redundancy (pairs / lags)</span></div>
                  <div><b>{co.contiguous}</b><span>contiguous virtual ULA elements</span></div>
                </div>
                <small>
                  {co.isGolomb
                    ? 'Golomb ruler: every lag appears at most once (bars are green), so no baseline is wasted. Red columns are lags it cannot measure.'
                    : co.isComplete
                      ? 'Complete sparse ruler: every lag from 1 to L is present (amber bars are measured more than once). Second-order DOA methods can treat the co-array as a filled virtual ULA of the full aperture.'
                      : 'Some lags repeat (amber) and some are missing (red).'}{' '}
                  A co-array-based DOA estimator can resolve up to {co.contiguous} sources with {marks.length} sensors.
                </small>
                <h3>MIMO virtual array (Tx = Rx = this ruler)</h3>
                <div className="stats">
                  <div><b>{virt.positions.length}</b><span>virtual elements{golomb ? ` (= N(N+1)/2 = ${(marks.length * (marks.length + 1)) / 2})` : ''}</span></div>
                  <div><b>{(virt.aperture * spacing).toFixed(1)} λ</b><span>virtual aperture ({(virt.aperture * dMm).toFixed(0)} mm)</span></div>
                  <div><b>{virt.contiguous}</b><span>contiguous virtual elements</span></div>
                  <div><b>{((virt.aperture + 1) / marks.length ** 2).toFixed(1)}×</b><span>aperture / N² physical pairs</span></div>
                </div>
              </section>

              <section className="card">
                <h2>Export</h2>
                <div className="row wrap">
                  <button className="btn" onClick={() => download(`${exportBase}-positions.csv`, positionsCsv(marks, dMm, marksY ?? undefined, dMm))}>
                    Element positions CSV (mm)
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      download(
                        `${exportBase}-pattern.csv`,
                        patternCsv([
                          { name: 'ruler_db', pattern: a.pat },
                          { name: 'ula_same_n_db', pattern: a.ulaN.pat },
                          { name: 'ula_same_aperture_db', pattern: a.ulaA.pat },
                          ...(ay ? [{ name: 'y_cut_db', pattern: ay.pat }] : []),
                        ]),
                      )
                    }
                  >
                    Pattern CSV (dB)
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      const svg = document.getElementById('pattern-svg')
                      if (svg) download(`${exportBase}-pattern.svg`, new XMLSerializer().serializeToString(svg), 'image/svg+xml')
                    }}
                    disabled={view !== 'cartesian'}
                    title={view !== 'cartesian' ? 'Switch to the Cartesian view' : undefined}
                  >
                    Pattern SVG
                  </button>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <footer>
        Runs entirely in your browser. Golomb rulers: OEIS A003022 / distributed.net OGR. Wichmann (1963) construction for sparse rulers.{' '}
        <a href="https://github.com/hermes98761234/sparse-array-designer">Source on GitHub</a>.
      </footer>
    </div>
  )
}
