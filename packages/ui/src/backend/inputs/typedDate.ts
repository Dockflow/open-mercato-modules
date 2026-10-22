/**
 * A date, or a date and time, as people type it into a cell — pure, no React: the grid's editors and its coercion table
 * (`coerceCellValue`: typed, pasted, filled, imported) read it the same way. `new Date('05.10.2026')` is the 10th of May,
 * so a dotted date is always read day first, and one that is not a whole date is refused rather than guessed
 * (FMS acc-v17 F3.16, 22–23.10).
 */

const DAY_FIRST = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/
const DOTTED = /^\d{1,2}\.\d{1,2}\./

/** That local moment, or null when the parts are no real day and time (31.02, 25:00 roll over). */
function localMoment(y: number, m: number, d: number, hh: number, mm: number): Date | null {
  const date = new Date(y, m - 1, d, hh, mm)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && date.getHours() === hh && date.getMinutes() === mm ? date : null
}

/**
 * A typed date and time read as that local moment: 'DD.MM.RRRR' or 'D.M.RRRR', 'YYYY-MM-DD', either with ' HH:mm', an ISO
 * timestamp, a Date or epoch milliseconds; null otherwise.
 */
export function parseTypedDateTime(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null
  const text = String(value ?? '').trim()
  if (!text) return null
  const parts = DAY_FIRST.exec(text) ?? ISO.exec(text)
  if (parts) {
    const [y, m, d] = parts[0].includes('.') ? [parts[3], parts[2], parts[1]] : [parts[1], parts[2], parts[3]]
    return localMoment(Number(y), Number(m), Number(d), Number(parts[4] ?? 0), Number(parts[5] ?? 0))
  }
  // '5.10.26', '20.10.2026x': `new Date` would read it month first.
  if (DOTTED.test(text)) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** A typed date read as that local day, its time (if any) left out. */
export function parseTypedDate(value: unknown): Date | null {
  const date = parseTypedDateTime(value)
  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null
}

/** A day as the cell's value — 'YYYY-MM-DD', local — whatever form it was typed in. */
export function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
