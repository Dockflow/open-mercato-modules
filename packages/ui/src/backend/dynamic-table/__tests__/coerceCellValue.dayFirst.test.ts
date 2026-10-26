/**
 * FMS acc-v17 (pB 23.10, after F3.16): every write into a date cell — typed and saved, pasted, filled, imported — goes
 * through `coerceCellValue`, which read the text with `new Date`. '05.10.2026' is 10 May there, so any day up to the 12th
 * typed DD.MM.RRRR swapped with its month, silently; the datetime editor did the same. A dotted date is day first; one
 * that is not a whole date ('5.10.26') is refused, never guessed.
 */
import { coerceCellValue } from '../utils/coerceCellValue'
import { createDateTimeEditor } from '../components/editors'
import type { ColumnDef } from '../types/index'

const day: ColumnDef = { data: 'paidAt', type: 'date' }
const withTime: ColumnDef = { data: 'eta', type: 'date', editor: createDateTimeEditor() }

describe('coerceCellValue — a dotted date is day first', () => {
  it('stores 05.10.2026 as the 5th of October, not the 10th of May', () => {
    expect(coerceCellValue('05.10.2026', day)).toEqual({ ok: true, value: '2026-10-05' })
    expect(coerceCellValue('5.1.2026', day)).toEqual({ ok: true, value: '2026-01-05' })
  })

  it('keeps the hour of a day-first date and time in a datetime cell', () => {
    expect(coerceCellValue('05.10.2026 14:30', withTime)).toEqual({ ok: true, value: '2026-10-05T14:30' })
    expect(coerceCellValue('2026-10-05 14:30', withTime)).toEqual({ ok: true, value: '2026-10-05T14:30' })
  })

  it('refuses what is not a whole day instead of guessing it month first', () => {
    for (const text of ['31.02.2026', '5.10.26', '20.10.2026x', '05.10.2026 25:00']) {
      expect(coerceCellValue(text, day)).toEqual({ ok: false, reason: 'notCoercible' })
    }
  })

  it('still takes a Date, a timestamp and an ISO moment', () => {
    expect(coerceCellValue(new Date(2026, 9, 5), day)).toEqual({ ok: true, value: '2026-10-05' })
    expect(coerceCellValue(new Date(2026, 9, 5, 9, 15).getTime(), withTime)).toEqual({ ok: true, value: '2026-10-05T09:15' })
    expect(coerceCellValue(new Date(2026, 9, 5, 12).toISOString(), day)).toEqual({ ok: true, value: '2026-10-05' })
  })
})
