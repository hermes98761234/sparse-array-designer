import { describe, expect, it } from 'vitest'
import { exactSparse, isSparseRuler, missingLags, wichmann, wichmannLength, wichmannRuler } from './sparse'

describe('Wichmann rulers', () => {
  it('W(r,s) is complete, has 4r+s+3 marks and the closed-form length', () => {
    for (let r = 0; r <= 6; r++) {
      for (let s = 0; s <= 8; s++) {
        const w = wichmann(r, s)
        const L = wichmannLength(r, s)
        expect(w[w.length - 1]).toBe(L)
        expect(w).toHaveLength(4 * r + s + 3)
        expect(missingLags(w, L)).toEqual([])
      }
    }
  })
  it('W(1,1) is the 8-mark ruler of length 22', () => {
    expect(wichmann(1, 1)).toEqual([0, 1, 3, 6, 13, 17, 21, 22])
  })
  it('wichmannRuler covers all lags for every length 1..200', () => {
    for (let L = 1; L <= 200; L++) {
      const m = wichmannRuler(L)
      expect(isSparseRuler(m, L)).toBe(true)
      // far fewer marks than a full array, near the sqrt(2.4 L) bound
      if (L > 30) expect(m.length).toBeLessThan(2.4 * Math.sqrt(2.434 * L))
    }
  })
  it('is exactly Wichmann at Wichmann lengths', () => {
    expect(wichmannRuler(22)).toHaveLength(8)
    expect(wichmannRuler(wichmannLength(3, 4))).toHaveLength(4 * 3 + 4 + 3)
  })
})

describe('exact minimal sparse rulers', () => {
  // OEIS A046693: minimum marks for a complete ruler of length n
  const minMarks = [2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8]
  it('matches the known minimum mark counts for L=1..23', () => {
    minMarks.forEach((k, i) => {
      const L = i + 1
      const m = exactSparse(L)!
      expect(isSparseRuler(m, L)).toBe(true)
      expect(m).toHaveLength(k)
    })
  })
  it('Wichmann heuristic is never worse than 1 mark above the optimum for L<=23', () => {
    minMarks.forEach((k, i) => expect(wichmannRuler(i + 1).length).toBeLessThanOrEqual(k + 1))
  })
  it('gives up when the node limit is hit', () => {
    expect(exactSparse(40, 10)).toBeNull()
  })
})
