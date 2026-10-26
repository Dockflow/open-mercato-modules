/** @jest-environment jsdom */
/**
 * FMS acc-v17 D6.04 (p7's GT walk 26.10, W6.04): a calendar in a Polish desk named today's day button
 * "Today, poniedziałek, 26 października 2026" — the day picker's own words are English. The words go through the
 * app's dictionary ("Dzisiaj", "wybrany", the month arrows); without a dictionary the calendar keeps its English.
 */
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { pl } from 'date-fns/locale'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import { Calendar } from '../calendar'

const Provider = I18nProvider as unknown as React.FC<{ locale: string; dict: Record<string, string>; children: React.ReactNode }>
const PL = {
  'ui.datePicker.today': 'Dzisiaj',
  'ui.datePicker.selected': 'wybrany',
  'ui.datePicker.nextMonth': 'Następny miesiąc',
  'ui.datePicker.previousMonth': 'Poprzedni miesiąc',
}

describe('Calendar — its own words in the app language', () => {
  it("today's day button and the month arrows read in Polish", () => {
    const today = new Date()
    render(
      <Provider locale="pl" dict={PL}>
        <Calendar mode="single" locale={pl} selected={today} defaultMonth={today} />
      </Provider>,
    )
    const day = screen.getAllByRole('button').find((b) => /^Dzisiaj, /.test(b.getAttribute('aria-label') ?? ''))
    expect(day?.getAttribute('aria-label')).toMatch(/^Dzisiaj, .+, wybrany$/)
    expect(screen.queryAllByRole('button').some((b) => /^Today/.test(b.getAttribute('aria-label') ?? ''))).toBe(false)
    expect(screen.getByRole('button', { name: 'Następny miesiąc' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Poprzedni miesiąc' })).toBeTruthy()
  })

  it('without a dictionary it keeps the English words', () => {
    render(<Calendar mode="single" defaultMonth={new Date(2026, 1, 1)} />)
    expect(screen.getByRole('button', { name: 'Go to the Next Month' })).toBeTruthy()
  })
})
