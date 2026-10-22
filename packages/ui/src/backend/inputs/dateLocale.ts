"use client"

import type { Locale } from 'date-fns'
import { de } from 'date-fns/locale/de'
import { enUS } from 'date-fns/locale/en-US'
import { es } from 'date-fns/locale/es'
import { pl } from 'date-fns/locale/pl'
import { useLocale } from '@open-mercato/shared/lib/i18n/context'

const DATE_FNS_LOCALES: Record<string, Locale> = { pl, de, es, en: enUS }

/**
 * The date-fns locale of an app language ('pl', 'pl-PL', 'en'…): month and day
 * names and the first day of the week for a `Calendar` / `DatePicker`. English
 * for a language without one.
 */
export function dateFnsLocaleFor(appLocale: string | null | undefined): Locale {
  const code = String(appLocale ?? '').split('-')[0]?.toLowerCase() ?? ''
  return DATE_FNS_LOCALES[code] ?? enUS
}

/** The date-fns locale of the app's current language (needs the I18nProvider). */
export function useDateFnsLocale(): Locale {
  return dateFnsLocaleFor(useLocale())
}

const ISO_DATE_PLACEHOLDERS: Record<string, string> = {
  pl: 'RRRR-MM-DD',
  de: 'JJJJ-MM-TT',
  es: 'AAAA-MM-DD',
}

/** The typed-date hint for a `yyyy-MM-dd` input, in the language's own letters ("RRRR-MM-DD" in Polish). */
export function isoDatePlaceholderFor(appLocale: string | null | undefined): string {
  const code = String(appLocale ?? '').split('-')[0]?.toLowerCase() ?? ''
  return ISO_DATE_PLACEHOLDERS[code] ?? 'YYYY-MM-DD'
}

/**
 * How a person in a day-first language types a date in a grid cell (FMS acc-v17 F3.16, 22.10: the Polish editor
 * said 'RRRR-MM-DD' and a typed '21.10.2026' was never read). Languages not listed keep the ISO form.
 */
const DAY_FIRST_PLACEHOLDERS: Record<string, string> = {
  pl: 'DD.MM.RRRR',
  de: 'TT.MM.JJJJ',
}

/** The hint a typed date follows in the app's language: 'DD.MM.RRRR' in Polish, else the ISO hint. */
export function typedDatePlaceholderFor(appLocale: string | null | undefined): string {
  const code = String(appLocale ?? '').split('-')[0]?.toLowerCase() ?? ''
  return DAY_FIRST_PLACEHOLDERS[code] ?? isoDatePlaceholderFor(appLocale)
}

/** The day as the app's language writes it in a cell: '21.10.2026' in a day-first language, else '2026-10-21'. */
export function formatTypedDate(date: Date, appLocale: string | null | undefined): string {
  const code = String(appLocale ?? '').split('-')[0]?.toLowerCase() ?? ''
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return DAY_FIRST_PLACEHOLDERS[code] ? `${dd}.${mm}.${date.getFullYear()}` : `${date.getFullYear()}-${mm}-${dd}`
}

/** A typed date read as that local day: 'DD.MM.RRRR' (or 'D.M.RRRR'), 'YYYY-MM-DD' or an ISO timestamp; null otherwise. */
export function parseTypedDate(value: unknown): Date | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const dayFirst = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text)
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const [y, m, d] = dayFirst ? [Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1])] : isoDay ? [Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3])] : [NaN, NaN, NaN]
  if (dayFirst || isoDay) {
    const date = new Date(y, m - 1, d)
    // 31.02.2026 is no day: the Date rolls over, so the parts no longer match.
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** A day as the cell's value — 'YYYY-MM-DD', local — whatever form it was typed in. */
export function toIsoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

