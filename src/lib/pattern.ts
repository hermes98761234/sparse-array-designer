// Radiation pattern of a linear array of identical elements at x_i (in wavelengths) along the
// x axis. theta is measured from broadside, u = sin(theta) is the direction cosine, so
//   AF(u) = sum_i exp(j 2 pi x_i (u - u0)),   u0 = sin(steering angle).
// For N equally spaced elements |AF|/N = |sin(N psi/2) / (N sin(psi/2))| with psi = 2 pi d (u - u0).

export const C0 = 299792458 // m/s
export const FLOOR_DB = -80
const RAD = Math.PI / 180

export type ElementKind = 'isotropic' | 'dipole' | 'patch'
export interface ElementModel {
  kind: ElementKind
  /** exponent of the patch power pattern cos^q(theta) */
  q: number
}

export function wavelengthMm(freqHz: number): number {
  return (C0 / freqHz) * 1000
}

/**
 * Element power pattern at direction cosine u (theta from broadside).
 * dipole: half-wave dipole collinear with the array, field cos(pi/2 u)/cos(theta);
 * patch: power cos^q(theta).
 */
export function elementPower(el: ElementModel, u: number): number {
  const c2 = 1 - u * u
  if (c2 <= 1e-12) return el.kind === 'isotropic' ? 1 : 0
  switch (el.kind) {
    case 'isotropic':
      return 1
    case 'dipole': {
      const e = Math.cos((Math.PI / 2) * u) / Math.sqrt(c2)
      return e * e
    }
    case 'patch':
      return Math.pow(c2, el.q / 2)
  }
}

/** Normalised array-factor power |AF|^2 / N^2 at direction cosine u. */
export function arrayFactorPower(xs: ArrayLike<number>, u: number, u0: number): number {
  let re = 0
  let im = 0
  const k = 2 * Math.PI * (u - u0)
  for (let i = 0; i < xs.length; i++) {
    const ph = k * xs[i]
    re += Math.cos(ph)
    im += Math.sin(ph)
  }
  return (re * re + im * im) / (xs.length * xs.length)
}

const toDb = (p: number) => Math.max(FLOOR_DB, 10 * Math.log10(Math.max(p, 1e-30)))

export interface Pattern {
  thetaDeg: Float64Array
  /** total pattern (array factor x element), dB, 0 dB = global maximum */
  db: Float64Array
  /** array factor alone, dB relative to its own maximum (N^2) */
  afDb: Float64Array
}

export const PATTERN_POINTS = 3601

/** Pattern over theta in [-90, 90] degrees. */
export function linearPattern(xs: ArrayLike<number>, steerDeg: number, el: ElementModel, points = PATTERN_POINTS): Pattern {
  const u0 = Math.sin(steerDeg * RAD)
  const thetaDeg = new Float64Array(points)
  const p = new Float64Array(points)
  const af = new Float64Array(points)
  let max = 0
  for (let i = 0; i < points; i++) {
    thetaDeg[i] = -90 + (180 * i) / (points - 1)
    const u = Math.sin(thetaDeg[i] * RAD)
    af[i] = arrayFactorPower(xs, u, u0)
    p[i] = af[i] * elementPower(el, u)
    if (p[i] > max) max = p[i]
  }
  const db = new Float64Array(points)
  const afDb = new Float64Array(points)
  for (let i = 0; i < points; i++) {
    db[i] = toDb(p[i] / max)
    afDb[i] = toDb(af[i])
  }
  return { thetaDeg, db, afDb }
}

export interface Metrics {
  peakDeg: number
  /** half-power beamwidth in degrees, null if the beam runs off the visible region */
  hpbwDeg: number | null
  /** offset of the first null from the peak on each side (degrees, positive), null if none */
  nullLeftDeg: number | null
  nullRightDeg: number | null
  /** highest sidelobe outside the main lobe, dB below the main peak (negative), null if none */
  pslDb: number | null
}

/** Beam metrics from a sampled dB pattern; the main lobe is the one containing the steering direction. */
export function patternMetrics(pat: Pattern, steerDeg: number): Metrics {
  const { thetaDeg: th, db } = pat
  const n = db.length
  const dth = th[1] - th[0]
  let ip = Math.min(n - 1, Math.max(0, Math.round((steerDeg - th[0]) / dth)))
  for (;;) {
    if (ip > 0 && db[ip - 1] > db[ip]) ip--
    else if (ip < n - 1 && db[ip + 1] > db[ip]) ip++
    else break
  }
  const peak = db[ip]
  const cross = (dir: 1 | -1, level: number): number | null => {
    for (let i = ip; i > 0 && i < n - 1; i += dir) {
      const a = db[i]
      const b = db[i + dir]
      if (b <= level && a > level) return th[i] + (dir * dth * (a - level)) / (a - b)
    }
    return null
  }
  const hi = cross(1, peak - 3)
  const lo = cross(-1, peak - 3)
  const firstNull = (dir: 1 | -1): number | null => {
    let i = ip
    while (i + dir >= 0 && i + dir < n && db[i + dir] <= db[i]) i += dir
    return i + dir >= 0 && i + dir < n ? i : null
  }
  const iR = firstNull(1)
  const iL = firstNull(-1)
  const from = iL ?? 0
  const to = iR ?? n - 1
  let psl: number | null = null
  for (let i = 0; i < n; i++) {
    if (i >= from && i <= to) continue
    const left = i === 0 ? -Infinity : db[i - 1]
    const right = i === n - 1 ? -Infinity : db[i + 1]
    if (db[i] >= left && db[i] >= right && (psl === null || db[i] - peak > psl)) psl = db[i] - peak
  }
  return {
    peakDeg: th[ip],
    hpbwDeg: hi !== null && lo !== null ? hi - lo : null,
    nullLeftDeg: iL === null ? null : th[ip] - th[iL],
    nullRightDeg: iR === null ? null : th[iR] - th[ip],
    pslDb: psl,
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * Angles (degrees) of grating lobes: full-strength copies of the main beam in the visible region.
 * Elements on a lattice of pitch g*d (g = gcd of the mark positions) repeat the pattern every
 * 1/(g d) in u.
 */
export function gratingLobes(marks: readonly number[], spacingLambda: number, steerDeg: number): number[] {
  const g = marks.reduce((acc, m) => gcd(acc, Math.abs(m)), 0)
  if (g === 0 || spacingLambda <= 0) return []
  const period = 1 / (g * spacingLambda)
  const u0 = Math.sin(steerDeg * RAD)
  const out: number[] = []
  for (let k = -Math.ceil(2 / period); k <= Math.ceil(2 / period); k++) {
    if (k === 0) continue
    const u = u0 + k * period
    if (Math.abs(u) <= 1 + 1e-9) out.push(Math.asin(Math.max(-1, Math.min(1, u))) / RAD)
  }
  return out.sort((a, b) => a - b)
}

/** Positions of the marks in wavelengths. */
export const positionsLambda = (marks: readonly number[], spacingLambda: number) => marks.map((m) => m * spacingLambda)

/** Filled uniform array with the given number of elements. */
export const ulaMarks = (count: number) => Array.from({ length: count }, (_, i) => i)

// ---------- planar (product of two rulers) ----------

export interface Heatmap {
  size: number
  /** dB, row-major with v from +1 (top) to -1; NaN outside the unit circle */
  db: Float32Array
}

/** Separable product array: AF(u,v) = AFx(u) AFy(v). Element patterns use u, v of the unit disk. */
export function planarPattern(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  steerXDeg: number,
  steerYDeg: number,
  el: ElementModel,
  size = 181,
): Heatmap {
  const u0 = Math.sin(steerXDeg * RAD)
  const v0 = Math.sin(steerYDeg * RAD)
  const fx = new Float64Array(size)
  const fy = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    const c = -1 + (2 * i) / (size - 1)
    fx[i] = arrayFactorPower(xs, c, u0)
    fy[i] = arrayFactorPower(ys, c, v0)
  }
  const raw = new Float64Array(size * size)
  let max = 0
  for (let r = 0; r < size; r++) {
    const v = 1 - (2 * r) / (size - 1)
    for (let c = 0; c < size; c++) {
      const u = -1 + (2 * c) / (size - 1)
      const rho2 = u * u + v * v
      if (rho2 > 1) {
        raw[r * size + c] = NaN
        continue
      }
      const cosT = Math.sqrt(1 - rho2)
      let e = 1
      if (el.kind === 'patch') e = Math.pow(cosT, el.q)
      else if (el.kind === 'dipole') {
        // half-wave dipole along x: field cos(pi/2 u)/sin(alpha), cos(alpha) = u
        const s2 = 1 - u * u
        e = s2 < 1e-12 ? 0 : Math.pow(Math.cos((Math.PI / 2) * u), 2) / s2
      }
      const p = fx[c] * fy[r] * e
      raw[r * size + c] = p
      if (p > max) max = p
    }
  }
  const db = new Float32Array(size * size)
  for (let i = 0; i < raw.length; i++) db[i] = Number.isNaN(raw[i]) ? NaN : toDb(raw[i] / max)
  return { size, db }
}
