// Co-arrays: the virtual arrays that second-order processing (DOA, MIMO radar) can synthesise.

export interface DifferenceCoarray {
  /** multiplicity[d] = number of element pairs with spacing d (index 0 unused) */
  multiplicity: number[]
  aperture: number
  /** lags in 1..aperture that no pair measures */
  holes: number[]
  /** largest M such that lags 1..M are all present: the contiguous virtual ULA length */
  contiguous: number
  distinct: number
  pairs: number
  /** pairs / distinct lags; 1 for a Golomb ruler */
  redundancy: number
  isGolomb: boolean
  isComplete: boolean
}

export function differenceCoarray(marks: readonly number[]): DifferenceCoarray {
  const L = marks.length ? Math.max(...marks) - Math.min(...marks) : 0
  const multiplicity = new Array<number>(L + 1).fill(0)
  let pairs = 0
  for (let i = 0; i < marks.length; i++) {
    for (let j = i + 1; j < marks.length; j++) {
      multiplicity[Math.abs(marks[j] - marks[i])]++
      pairs++
    }
  }
  const holes: number[] = []
  let distinct = 0
  let contiguous = 0
  let run = true
  for (let d = 1; d <= L; d++) {
    if (multiplicity[d] === 0) {
      holes.push(d)
      run = false
    } else {
      distinct++
      if (run) contiguous = d
    }
  }
  return {
    multiplicity,
    aperture: L,
    holes,
    contiguous,
    distinct,
    pairs,
    redundancy: distinct ? pairs / distinct : 1,
    isGolomb: multiplicity.every((m) => m <= 1),
    isComplete: holes.length === 0,
  }
}

export interface VirtualArray {
  positions: number[]
  aperture: number
  /** length of the gap-free run starting at the first position, counted in elements */
  contiguous: number
}

/** MIMO virtual array: transmit positions + receive positions (Minkowski sum). */
export function sumCoarray(tx: readonly number[], rx: readonly number[]): VirtualArray {
  const set = new Set<number>()
  for (const a of tx) for (const b of rx) set.add(a + b)
  const positions = [...set].sort((a, b) => a - b)
  let contiguous = positions.length ? 1 : 0
  while (contiguous < positions.length && positions[contiguous] === positions[contiguous - 1] + 1) contiguous++
  return { positions, aperture: positions.length ? positions[positions.length - 1] - positions[0] : 0, contiguous }
}
