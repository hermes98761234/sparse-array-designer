import { describe, expect, it } from 'vitest'
import { arrayFactorPower, elementPower, gratingLobes, linearPattern, patternMetrics, planarPattern, ulaMarks, wavelengthMm } from './pattern'
import { OGR } from './golomb'

const ISO = { kind: 'isotropic', q: 1 } as const
const RAD = Math.PI / 180

describe('array factor', () => {
  it('ULA matches sin(N psi/2) / (N sin(psi/2))', () => {
    for (const N of [2, 4, 8, 16]) {
      for (const d of [0.25, 0.5, 0.7]) {
        const xs = ulaMarks(N).map((m) => m * d)
        for (const u of [0.05, 0.13, 0.3, 0.5, 0.77, 0.9]) {
          for (const u0 of [0, 0.4]) {
            const psi = 2 * Math.PI * d * (u - u0)
            const closed = Math.sin((N * psi) / 2) / (N * Math.sin(psi / 2))
            expect(Math.sqrt(arrayFactorPower(xs, u, u0))).toBeCloseTo(Math.abs(closed), 10)
          }
        }
      }
    }
  })
  it('is unity at the steering direction for any ruler', () => {
    const xs = OGR[9].map((m) => m * 0.5)
    expect(arrayFactorPower(xs, Math.sin(30 * RAD), Math.sin(30 * RAD))).toBeCloseTo(1, 12)
  })
})

describe('metrics', () => {
  it('ULA broadside HPBW is about 0.886 lambda/(N d)', () => {
    for (const [N, d] of [[16, 0.5], [32, 0.5], [20, 0.6]] as const) {
      const pat = linearPattern(ulaMarks(N).map((m) => m * d), 0, ISO)
      const m = patternMetrics(pat, 0)
      const expected = (0.886 / (N * d)) / RAD
      expect(m.hpbwDeg!).toBeGreaterThan(expected * 0.97)
      expect(m.hpbwDeg!).toBeLessThan(expected * 1.03)
    }
  })
  it('ULA first null at sin(theta) = lambda/(N d) and PSL about -13.26 dB', () => {
    const N = 16
    const m = patternMetrics(linearPattern(ulaMarks(N).map((i) => i * 0.5), 0, ISO), 0)
    expect(Math.sin(m.nullRightDeg! * RAD)).toBeCloseTo(1 / (N * 0.5), 2)
    expect(m.nullLeftDeg!).toBeCloseTo(m.nullRightDeg!, 1)
    expect(m.pslDb!).toBeGreaterThan(-13.6)
    expect(m.pslDb!).toBeLessThan(-13.0)
  })
  it('steering moves the peak', () => {
    const pat = linearPattern(ulaMarks(8).map((i) => i * 0.5), 25, ISO)
    expect(patternMetrics(pat, 25).peakDeg).toBeCloseTo(25, 1)
  })
  it('a patch element narrows the pattern towards broadside and nulls the horizon', () => {
    expect(elementPower({ kind: 'patch', q: 2 }, 0)).toBe(1)
    expect(elementPower({ kind: 'patch', q: 2 }, 1)).toBe(0)
    expect(elementPower({ kind: 'dipole', q: 1 }, 0)).toBeCloseTo(1, 12)
    expect(elementPower({ kind: 'dipole', q: 1 }, 1)).toBe(0)
  })
})

describe('grating lobes', () => {
  it('none at lambda/2, present at 1 lambda spacing', () => {
    expect(gratingLobes(ulaMarks(8), 0.5, 0)).toEqual([])
    expect(gratingLobes(ulaMarks(8), 1, 0).map(Math.round)).toEqual([-90, 90])
  })
  it('appear when steering a lambda/2 ULA to endfire', () => {
    expect(gratingLobes(ulaMarks(8), 0.5, 90)).toHaveLength(1)
  })
  it('agree with the numerical pattern', () => {
    const N = 6
    const xs = ulaMarks(N).map((i) => i * 1.5)
    const pat = linearPattern(xs, 0, ISO)
    const g = gratingLobes(ulaMarks(N), 1.5, 0)
    expect(g).toHaveLength(2)
    const i = pat.thetaDeg.findIndex((t) => Math.abs(t - g[1]) < 0.03)
    expect(pat.afDb[i]).toBeGreaterThan(-0.1)
  })
  it('a ruler with a common factor in its marks has grating lobes at lambda/2 pitch units', () => {
    expect(gratingLobes([0, 2, 6], 0.5, 0).length).toBeGreaterThan(0)
  })
})

describe('planar', () => {
  it('peaks at 0 dB at the steering direction and is separable', () => {
    const xs = OGR[5].map((m) => m * 0.5)
    const h = planarPattern(xs, xs, 0, 0, ISO, 101)
    const c = 50
    expect(h.db[c * 101 + c]).toBeCloseTo(0, 6)
    expect(h.db[0]).toBeNaN()
    // symmetric ruler product: pattern(u,v) == pattern(v,u)
    expect(h.db[40 * 101 + 70]).toBeCloseTo(h.db[(100 - 70) * 101 + (100 - 40)], 4)
  })
})

describe('wavelength', () => {
  it('is 150 mm at 2 GHz', () => {
    expect(wavelengthMm(2e9)).toBeCloseTo(149.896, 2)
  })
})
