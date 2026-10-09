import type { Pattern } from './pattern'

const num = (x: number, digits = 4) => String(+x.toFixed(digits))

/** Element positions in millimetres (x along the ruler, y for the second ruler of a planar array). */
export function positionsCsv(marksX: readonly number[], spacingMm: number, marksY?: readonly number[], spacingYMm = spacingMm): string {
  const rows = ['index,x_mm,y_mm']
  let i = 1
  for (const my of marksY ?? [0]) {
    for (const mx of marksX) rows.push(`${i++},${num(mx * spacingMm)},${num(my * spacingYMm)}`)
  }
  return rows.join('\n') + '\n'
}

export interface PatternColumn {
  name: string
  pattern: Pattern
}

/** Pattern columns sampled on the common theta grid (dB, 0 dB = each pattern's own maximum). */
export function patternCsv(columns: readonly PatternColumn[], step = 10): string {
  if (!columns.length) return 'theta_deg\n'
  const th = columns[0].pattern.thetaDeg
  const rows = [['theta_deg', ...columns.map((c) => c.name)].join(',')]
  for (let i = 0; i < th.length; i += step) rows.push([num(th[i], 3), ...columns.map((c) => num(c.pattern.db[i], 3))].join(','))
  return rows.join('\n') + '\n'
}
