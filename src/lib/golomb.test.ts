import { describe, expect, it } from 'vitest'
import { OGR, OGR_LENGTH, branchAndBound, constructGolomb, heuristicGolomb, isGolomb } from './golomb'

describe('OGR table', () => {
  for (let n = 1; n <= 28; n++) {
    it(`OGR-${n} is a Golomb ruler with ${n} marks and the documented length`, () => {
      const m = OGR[n]
      expect(m).toHaveLength(n)
      expect(m[0]).toBe(0)
      expect([...m].sort((a, b) => a - b)).toEqual(m)
      expect(isGolomb(m)).toBe(true)
      expect(m[n - 1]).toBe(OGR_LENGTH[n])
    })
  }
})

describe('isGolomb', () => {
  it('rejects repeated differences', () => {
    expect(isGolomb([0, 1, 2])).toBe(false)
    expect(isGolomb([0, 1, 3])).toBe(true)
  })
})

describe('branch and bound', () => {
  const known: Record<number, number> = { 3: 3, 4: 6, 5: 11, 6: 17, 7: 25, 8: 34, 9: 44 }
  for (const [n, len] of Object.entries(known)) {
    it(`finds the optimal length ${len} for n=${n}`, () => {
      const r = branchAndBound(+n)!
      expect(r.length).toBe(len)
      expect(r.marks).toHaveLength(+n)
      expect(isGolomb(r.marks)).toBe(true)
      expect(r.marks[0]).toBe(0)
      expect(r.marks[+n - 1]).toBe(len)
    })
  }
  it('can be aborted', () => {
    expect(branchAndBound(11, { onProgress: () => true })).toBeNull()
  })
})

describe('heuristics', () => {
  it('algebraic construction gives Golomb rulers', () => {
    for (const n of [10, 20, 30, 40]) {
      const m = constructGolomb(n)
      expect(m).toHaveLength(n)
      expect(isGolomb(m)).toBe(true)
    }
  })
  it('local search stays Golomb and is no longer than the construction', () => {
    const base = constructGolomb(32)
    const r = heuristicGolomb(32, 300)
    expect(r.marks).toHaveLength(32)
    expect(isGolomb(r.marks)).toBe(true)
    expect(r.length).toBeLessThanOrEqual(base[31])
  })
  it('returns the table ruler when one is known', () => {
    expect(heuristicGolomb(12).marks).toEqual(OGR[12])
  })
})
