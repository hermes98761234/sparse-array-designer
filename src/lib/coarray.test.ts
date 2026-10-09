import { describe, expect, it } from 'vitest'
import { differenceCoarray, sumCoarray } from './coarray'
import { OGR } from './golomb'
import { wichmann } from './sparse'
import { positionsCsv } from './exportCsv'

describe('difference co-array', () => {
  it('Golomb ruler: every lag unique, N(N-1)/2 distinct lags, holes remain', () => {
    const c = differenceCoarray(OGR[8])
    expect(c.isGolomb).toBe(true)
    expect(c.distinct).toBe(28)
    expect(c.redundancy).toBe(1)
    expect(c.isComplete).toBe(false)
    expect(c.aperture).toBe(34)
    expect(c.holes).toHaveLength(34 - 28)
  })
  it('sparse ruler: complete coverage 1..L and redundancy above 1', () => {
    const c = differenceCoarray(wichmann(2, 3))
    expect(c.isComplete).toBe(true)
    expect(c.contiguous).toBe(c.aperture)
    expect(c.isGolomb).toBe(false)
    expect(c.redundancy).toBeGreaterThan(1)
  })
  it('ULA of N elements has redundancy and N-1 lags', () => {
    const c = differenceCoarray([0, 1, 2, 3, 4])
    expect(c.distinct).toBe(4)
    expect(c.multiplicity.slice(1)).toEqual([4, 3, 2, 1])
  })
})

describe('sum co-array (MIMO)', () => {
  it('Golomb Tx=Rx gives N(N+1)/2 distinct virtual elements', () => {
    const v = sumCoarray(OGR[6], OGR[6])
    expect(v.positions).toHaveLength(21)
    expect(v.aperture).toBe(34)
  })
  it('Tx = ULA of M with spacing N, Rx = ULA of N gives a filled M*N array', () => {
    const rx = [0, 1, 2, 3]
    const tx = [0, 4, 8]
    const v = sumCoarray(tx, rx)
    expect(v.positions).toHaveLength(12)
    expect(v.contiguous).toBe(12)
  })
})

describe('CSV', () => {
  it('positions in mm', () => {
    expect(positionsCsv([0, 1, 4], 75)).toBe('index,x_mm,y_mm\n1,0,0\n2,75,0\n3,300,0\n')
  })
})
