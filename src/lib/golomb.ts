// Golomb rulers: marks whose pairwise differences are all distinct. Used as sparse antenna
// arrays, every baseline (lag) occurs at most once, so the co-array has no redundancy.

/** Known optimal Golomb rulers (OGR-1..28, the last proven by distributed.net in 2022). */
export const OGR: Record<number, number[]> = {
  1: [0],
  2: [0, 1],
  3: [0, 1, 3],
  4: [0, 1, 4, 6],
  5: [0, 1, 4, 9, 11],
  6: [0, 1, 4, 10, 12, 17],
  7: [0, 1, 4, 10, 18, 23, 25],
  8: [0, 1, 4, 9, 15, 22, 32, 34],
  9: [0, 1, 5, 12, 25, 27, 35, 41, 44],
  10: [0, 1, 6, 10, 23, 26, 34, 41, 53, 55],
  11: [0, 1, 4, 13, 28, 33, 47, 54, 64, 70, 72],
  12: [0, 2, 6, 24, 29, 40, 43, 55, 68, 75, 76, 85],
  13: [0, 2, 5, 25, 37, 43, 59, 70, 85, 89, 98, 99, 106],
  14: [0, 4, 6, 20, 35, 52, 59, 77, 78, 86, 89, 99, 122, 127],
  15: [0, 4, 20, 30, 57, 59, 62, 76, 100, 111, 123, 136, 144, 145, 151],
  16: [0, 1, 4, 11, 26, 32, 56, 68, 76, 115, 117, 134, 150, 163, 168, 177],
  17: [0, 5, 7, 17, 52, 56, 67, 80, 81, 100, 122, 138, 159, 165, 168, 191, 199],
  18: [0, 2, 10, 22, 53, 56, 82, 83, 89, 98, 130, 148, 153, 167, 188, 192, 205, 216],
  19: [0, 1, 6, 25, 32, 72, 100, 108, 120, 130, 153, 169, 187, 190, 204, 231, 233, 242, 246],
  20: [0, 1, 8, 11, 68, 77, 94, 116, 121, 156, 158, 179, 194, 208, 212, 228, 240, 253, 259, 283],
  21: [0, 2, 24, 56, 77, 82, 83, 95, 129, 144, 179, 186, 195, 255, 265, 285, 293, 296, 310, 329, 333],
  22: [0, 1, 9, 14, 43, 70, 106, 122, 124, 128, 159, 179, 204, 223, 253, 263, 270, 291, 330, 341, 353, 356],
  23: [0, 3, 7, 17, 61, 66, 91, 99, 114, 159, 171, 199, 200, 226, 235, 246, 277, 316, 329, 348, 350, 366, 372],
  24: [0, 9, 33, 37, 38, 97, 122, 129, 140, 142, 152, 191, 205, 208, 252, 278, 286, 326, 332, 353, 368, 384, 403, 425],
  25: [0, 12, 29, 39, 72, 91, 146, 157, 160, 161, 166, 191, 207, 214, 258, 290, 316, 354, 372, 394, 396, 431, 459, 467, 480],
  26: [0, 1, 33, 83, 104, 110, 124, 163, 185, 200, 203, 249, 251, 258, 314, 318, 343, 356, 386, 430, 440, 456, 464, 475, 487, 492],
  27: [0, 3, 15, 41, 66, 95, 97, 106, 142, 152, 220, 221, 225, 242, 295, 330, 338, 354, 382, 388, 402, 415, 486, 504, 523, 546, 553],
  28: [0, 3, 15, 41, 66, 95, 97, 106, 142, 152, 220, 221, 225, 242, 295, 330, 338, 354, 382, 388, 402, 415, 486, 504, 523, 546, 553, 585],
}

/** Documented optimal lengths of OGR-n (OEIS A003022). */
export const OGR_LENGTH: Record<number, number> = {
  1: 0, 2: 1, 3: 3, 4: 6, 5: 11, 6: 17, 7: 25, 8: 34, 9: 44, 10: 55, 11: 72, 12: 85, 13: 106, 14: 127,
  15: 151, 16: 177, 17: 199, 18: 216, 19: 246, 20: 283, 21: 333, 22: 356, 23: 372, 24: 425, 25: 480,
  26: 492, 27: 553, 28: 585,
}

export function isGolomb(marks: readonly number[]): boolean {
  const seen = new Set<number>()
  for (let i = 0; i < marks.length; i++) {
    for (let j = i + 1; j < marks.length; j++) {
      const d = Math.abs(marks[j] - marks[i])
      if (d === 0 || seen.has(d)) return false
      seen.add(d)
    }
  }
  return true
}

/** Lower bound on the length of any Golomb ruler with k marks. */
function lengthBound(k: number): number {
  return OGR_LENGTH[k] ?? (k * (k - 1)) / 2
}

export interface BnbOptions {
  /** Called every ~2^20 nodes; return true to abort. */
  onProgress?: (info: { nodes: number; length: number }) => boolean | void
}

export interface BnbResult {
  marks: number[]
  length: number
  nodes: number
}

/**
 * Exact branch and bound. Tries lengths L = lower bound, +1, ... and returns the first ruler
 * found, which is therefore optimal. Pruning: the last k marks form a Golomb ruler, so mark i
 * can be at most L - OGR(n-1-i) (proven lengths of the shorter optimal rulers); symmetry is
 * broken by requiring the first gap to be smaller than the last one.
 * Returns null when aborted.
 */
export function branchAndBound(n: number, opts: BnbOptions = {}): BnbResult | null {
  if (n <= 2) return { marks: n === 1 ? [0] : [0, 1], length: n - 1, nodes: 0 }
  let nodes = 0
  let aborted = false
  for (let L = lengthBound(n - 1) + 1; ; L++) {
    const pos = new Int32Array(n)
    const used = new Uint8Array(L + 1)
    pos[0] = 0
    pos[n - 1] = L
    used[L] = 1
    // The ruler is {pos[0..k-1]} plus the fixed end mark L.
    const dfs = (k: number): boolean => {
      if (k === n - 1) return true
      if ((++nodes & 0xfffff) === 0 && opts.onProgress?.({ nodes, length: L }) === true) {
        aborted = true
        return false
      }
      const hi = L - lengthBound(n - k) // the remaining n-k marks (incl. L) span at least this
      const last = pos[k - 1]
      for (let p = last + 1; p <= hi; p++) {
        if (k === 1 && p >= L - p + 0 && 2 * p >= L) break // first gap < last gap (mirror symmetry)
        // new differences: p - pos[q] for all placed q, and L - p
        const dl = L - p
        if (used[dl]) continue
        let ok = true
        let q = 0
        for (; q < k; q++) {
          const d = p - pos[q]
          if (used[d] || d === dl) {
            ok = false
            break
          }
          used[d] = 1
        }
        if (ok) {
          used[dl] = 1
          pos[k] = p
          if (dfs(k + 1)) return true
          used[dl] = 0
          if (aborted) {
            for (let r = 0; r < q; r++) used[p - pos[r]] = 0
            return false
          }
        }
        for (let r = 0; r < q; r++) used[p - pos[r]] = 0
      }
      return false
    }
    if (dfs(1)) return { marks: Array.from(pos), length: L, nodes }
    if (aborted) return null
  }
}

// ---------- heuristic for larger n ----------

function isPrime(p: number): boolean {
  if (p < 2) return false
  for (let i = 2; i * i <= p; i++) if (p % i === 0) return false
  return true
}

function primitiveRoot(p: number): number {
  const factors: number[] = []
  let m = p - 1
  for (let f = 2; f * f <= m; f++) {
    if (m % f === 0) {
      factors.push(f)
      while (m % f === 0) m /= f
    }
  }
  if (m > 1) factors.push(m)
  const pow = (b: number, e: number) => {
    let r = 1
    let x = b % p
    for (; e > 0; e >>= 1, x = (x * x) % p) if (e & 1) r = (r * x) % p
    return r
  }
  for (let g = 2; g < p; g++) if (factors.every((f) => pow(g, (p - 1) / f) !== 1)) return g
  return 1
}

/** Best window of n consecutive marks of a ruler that is Golomb modulo M (wraps around). */
function bestWindow(marksMod: number[], M: number, n: number): number[] | null {
  const s = [...marksMod].sort((a, b) => a - b)
  if (s.length < n) return null
  const ext = [...s, ...s.map((x) => x + M)]
  let best: number[] | null = null
  for (let i = 0; i < s.length; i++) {
    const w = ext.slice(i, i + n).map((x) => x - ext[i])
    if (!best || w[n - 1] < best[n - 1]) best = w
  }
  return best
}

/** Algebraic constructions: Ruzsa (mod p(p-1)) and Erdős–Turán, windowed to n marks. */
export function constructGolomb(n: number): number[] {
  let best: number[] | null = null
  const consider = (w: number[] | null) => {
    if (w && isGolomb(w) && (!best || w[n - 1] < best[n - 1])) best = w
  }
  for (let p = Math.max(n, 3); p < n + 40; p++) {
    if (!isPrime(p)) continue
    // Erdős–Turán: 2pk + (k^2 mod p)
    consider(bestWindow(Array.from({ length: p }, (_, k) => 2 * p * k + ((k * k) % p)), 2 * p * p, n))
    // Ruzsa: p*i + (p-1) * g^i mod p(p-1)
    const g = primitiveRoot(p)
    const M = p * (p - 1)
    const marks: number[] = []
    let gi = 1
    for (let i = 1; i < p; i++) {
      gi = (gi * g) % p
      marks.push((p * i + (p - 1) * gi) % M)
    }
    consider(bestWindow(marks, M, n))
  }
  return best ?? Array.from({ length: n }, (_, i) => (i * (i + 1)) / 2 + i * i * i) // always Golomb-ish fallback
}

/** Small deterministic PRNG so searches are reproducible in tests. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface HeuristicResult {
  marks: number[]
  length: number
}

/**
 * Near-optimal Golomb ruler for any n: start from the best algebraic construction, then local
 * search (shorten by moving the last mark down; otherwise shuffle a random mark) until the
 * time budget runs out. Not proven optimal.
 */
export function heuristicGolomb(n: number, budgetMs = 1500, seed = 1, now: () => number = Date.now, useTable = true): HeuristicResult {
  if (useTable && OGR[n]) return { marks: [...OGR[n]], length: OGR_LENGTH[n] }
  const rand = mulberry32(seed)
  let cur = constructGolomb(n)
  let best = cur
  const t0 = now()
  const feasible = (marks: number[], skip: number, p: number) => {
    const used = new Set<number>()
    for (let i = 0; i < marks.length; i++) {
      if (i === skip) continue
      for (let j = i + 1; j < marks.length; j++) {
        if (j !== skip) used.add(Math.abs(marks[j] - marks[i]))
      }
    }
    const nd = new Set<number>()
    for (let i = 0; i < marks.length; i++) {
      if (i === skip) continue
      const d = Math.abs(p - marks[i])
      if (d === 0 || used.has(d) || nd.has(d)) return false
      nd.add(d)
    }
    return true
  }
  while (now() - t0 < budgetMs) {
    const next = [...cur].sort((a, b) => a - b)
    const L = next[n - 1]
    // 1. try to shorten: relocate the last mark lower
    let moved = false
    for (let p = next[n - 2] + 1; p < L; p++) {
      if (feasible(next, n - 1, p)) {
        next[n - 1] = p
        moved = true
        break
      }
    }
    if (!moved) {
      // 2. plateau move: relocate a random mark to a random feasible position
      const i = Math.floor(rand() * n)
      const cands: number[] = []
      for (let p = 0; p <= L; p++) if (!next.includes(p) && feasible(next, i, p)) cands.push(p)
      if (cands.length) next[i] = cands[Math.floor(rand() * cands.length)]
    }
    next.sort((a, b) => a - b)
    const shift = next[0]
    cur = next.map((x) => x - shift)
    if (cur[n - 1] < best[n - 1]) best = cur
    if (cur[n - 1] > best[n - 1] + 6) cur = best // don't wander off
  }
  return { marks: best, length: best[n - 1] }
}
