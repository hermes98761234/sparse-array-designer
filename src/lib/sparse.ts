// Sparse (minimum-redundancy) rulers: few marks that still measure every distance 1..L.

/** Distances 1..L not measured by the marks (marks assumed within 0..L). */
export function missingLags(marks: readonly number[], L: number): number[] {
  const have = new Uint8Array(L + 1)
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) have[Math.abs(marks[j] - marks[i])] = 1
  const out: number[] = []
  for (let d = 1; d <= L; d++) if (!have[d]) out.push(d)
  return out
}

export function isSparseRuler(marks: readonly number[], L = Math.max(...marks)): boolean {
  return marks.includes(0) && marks.includes(L) && missingLags(marks, L).length === 0
}

/** Wichmann ruler W(r,s): segment lengths 1^r, r+1, (2r+1)^r, (4r+3)^s, (2r+2)^(r+1), 1^r. */
export function wichmann(r: number, s: number): number[] {
  const steps: number[] = [
    ...Array<number>(r).fill(1),
    r + 1,
    ...Array<number>(r).fill(2 * r + 1),
    ...Array<number>(s).fill(4 * r + 3),
    ...Array<number>(r + 1).fill(2 * r + 2),
    ...Array<number>(r).fill(1),
  ]
  const marks = [0]
  for (const d of steps) marks.push(marks[marks.length - 1] + d)
  return marks
}

/** Length of W(r,s) = 4r(r+s+2) + 3(s+1). */
export const wichmannLength = (r: number, s: number) => 4 * r * (r + s + 2) + 3 * (s + 1)

/** Add the marks that cover the most missing lags until the ruler is complete. */
function repair(marks: number[], L: number): number[] {
  const out = [...marks]
  for (;;) {
    const miss = missingLags(out, L)
    if (miss.length === 0) return out.sort((a, b) => a - b)
    const have = new Set(out)
    let bestP = -1
    let bestGain = -1
    for (let p = 1; p < L; p++) {
      if (have.has(p)) continue
      const gain = new Set<number>()
      for (const m of out) {
        const d = Math.abs(p - m)
        if (d >= 1 && miss.includes(d)) gain.add(d)
      }
      if (gain.size > bestGain) {
        bestGain = gain.size
        bestP = p
      }
    }
    out.push(bestP)
  }
}

/**
 * Best Wichmann-based sparse ruler of length L, for any L. Exact Wichmann rulers are used when
 * their length matches; otherwise a longer Wichmann ruler is truncated at L and any lags it
 * lost are patched greedily. Always returns a valid complete ruler.
 */
export function wichmannRuler(L: number): number[] {
  if (L <= 0) return [0]
  let best: number[] = Array.from({ length: L + 1 }, (_, i) => i)
  const maxLen = Math.ceil(L * 1.5) + 12
  for (let r = 0; 4 * r * (r + 2) + 3 <= maxLen; r++) {
    for (let s = 0; wichmannLength(r, s) <= maxLen; s++) {
      const W = wichmannLength(r, s)
      if (W < L) continue
      const w = wichmann(r, s)
      const cut = W === L ? w : [...w.filter((x) => x < L), L]
      const cand = missingLags(cut, L).length === 0 ? cut : repair(cut, L)
      if (cand.length < best.length) best = cand
    }
  }
  return best
}

/**
 * Exact minimum number of marks for length L (iterative deepening with a counting bound).
 * Practical up to L of about 40. Returns null if aborted via the node limit.
 */
export function exactSparse(L: number, maxNodes = Infinity): number[] | null {
  if (L <= 0) return [0]
  if (L === 1) return [0, 1]
  let nodes = 0
  for (let k = 3; ; k++) {
    if ((k * (k - 1)) / 2 < L) continue
    const cover = new Int32Array(L + 1)
    const marks: number[] = [0, L]
    cover[L] = 1
    let uncovered = L - 1
    const add = (p: number) => {
      for (const m of marks) {
        const d = Math.abs(p - m)
        if (cover[d]++ === 0) uncovered--
      }
      marks.push(p)
    }
    const remove = () => {
      const p = marks.pop()!
      for (const m of marks) {
        const d = Math.abs(p - m)
        if (--cover[d] === 0) uncovered++
      }
    }
    let abort = false
    const walk = (from: number): boolean => {
      const left = k - marks.length
      if (left === 0) return uncovered === 0
      if (++nodes > maxNodes) {
        abort = true
        return false
      }
      let cap = 0
      for (let i = 0; i < left; i++) cap += marks.length + i
      if (cap < uncovered) return false
      for (let p = from; p < L; p++) {
        add(p)
        if (walk(p + 1)) return true
        remove()
        if (abort) return false
      }
      return false
    }
    const found = walk(1)
    if (found) return [...marks].sort((a, b) => a - b)
    if (abort) return null
  }
}
