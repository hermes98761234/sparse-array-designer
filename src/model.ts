import { OGR } from './lib/golomb'
import { wichmannRuler } from './lib/sparse'
import type { ElementKind } from './lib/pattern'

export type Mode = 'ogr' | 'golomb' | 'sparse' | 'custom'

export interface FoundGolomb {
  n: number
  marks: number[]
  method: 'exact' | 'heuristic'
  ms: number
}
export interface FoundSparse {
  length: number
  marks: number[]
  ms: number
}

export interface Settings {
  freq: number
  unit: 'MHz' | 'GHz'
  /** unit spacing in wavelengths */
  spacing: number
  mode: Mode
  ogrN: number
  searchN: number
  sparseL: number
  customText: string
  foundGolomb: FoundGolomb | null
  foundSparse: FoundSparse | null
  steer: number
  element: ElementKind
  patchQ: number
  showUlaN: boolean
  showUlaAperture: boolean
  planar: boolean
  /** ruler of the second axis: 0 = same as the first, otherwise OGR-n */
  yOgrN: number
  steerY: number
}

export const DEFAULTS: Settings = {
  freq: 2.4,
  unit: 'GHz',
  spacing: 0.5,
  mode: 'ogr',
  ogrN: 10,
  searchN: 9,
  sparseL: 22,
  customText: '0, 1, 4, 10, 12, 17',
  foundGolomb: null,
  foundSparse: null,
  steer: 0,
  element: 'isotropic',
  patchQ: 1.5,
  showUlaN: true,
  showUlaAperture: true,
  planar: false,
  yOgrN: 0,
  steerY: 0,
}

const KEY = 'sparse-array-designer:v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULTS
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage full or blocked */
  }
}

export function parseMarks(text: string): { marks: number[] | null; error?: string } {
  const parts = text.split(/[\s,;]+/).filter(Boolean)
  if (parts.length < 2) return { marks: null, error: 'Enter at least two integer marks.' }
  const nums = parts.map(Number)
  if (nums.some((x) => !Number.isInteger(x) || x < 0 || x > 5000)) return { marks: null, error: 'Marks must be integers between 0 and 5000.' }
  const uniq = [...new Set(nums)].sort((a, b) => a - b)
  if (uniq.length > 200) return { marks: null, error: 'At most 200 marks.' }
  return { marks: uniq.map((x) => x - uniq[0]) }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo))

export interface Resolved {
  marks: number[] | null
  label: string
  note?: string
}

export function resolveMarks(s: Pick<Settings, 'mode' | 'ogrN' | 'sparseL' | 'customText' | 'foundGolomb' | 'foundSparse'>): Resolved {
  switch (s.mode) {
    case 'ogr': {
      const n = clamp(s.ogrN, 2, 28)
      return { marks: OGR[n], label: `OGR-${n}`, note: `Optimal Golomb ruler, ${n} marks, length ${OGR[n][n - 1]}` }
    }
    case 'golomb': {
      const f = s.foundGolomb
      if (!f) return { marks: null, label: 'Golomb search' }
      return {
        marks: f.marks,
        label: `Golomb n=${f.n}`,
        note: `${f.method === 'exact' ? 'Proven optimal by branch and bound' : 'Heuristic, near-optimal'}, length ${f.marks[f.marks.length - 1]}`,
      }
    }
    case 'sparse': {
      const L = clamp(Math.round(s.sparseL), 1, 300)
      const f = s.foundSparse
      if (f && f.length === L) return { marks: f.marks, label: `Sparse L=${L}`, note: `Minimum marks, exact search` }
      return { marks: wichmannRuler(L), label: `Sparse L=${L}`, note: `Wichmann construction${L > 40 ? '' : ' (run the exact search for the minimum)'}` }
    }
    case 'custom': {
      const p = parseMarks(s.customText)
      return { marks: p.marks, label: 'Custom ruler', note: p.error }
    }
  }
}
