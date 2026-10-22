/** @jest-environment jsdom */
/**
 * FMS acc-v17 F3.21 (m1pro's walk 3.19, 22.10): the date range filter's calendar was English — 'December 2026', Su-first
 * weekdays, Clear / Today, the chosen day shown as 'Nov 01, 2026' — beside a Polish grid whose cell editor speaks
 * Polish. It speaks the app's language as the cell editor does, with the same keys.
 */
import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import { FilterDatePicker } from '../components/FilterDatePicker'

const PL = { 'ui.datePicker.clearButton': 'Wyczyść', 'ui.datePicker.todayButton': 'Dzisiaj' }
const weekdays = () => Array.from(document.querySelectorAll('thead th')).map((th) => th.getAttribute('aria-label'))

function renderPicker(locale: string, dict: Record<string, string>, value = '2026-11-01') {
  return render(
    <I18nProvider locale={locale} dict={dict}>
      <FilterDatePicker value={value} onChange={() => {}} ariaLabel="Od" />
    </I18nProvider>,
  )
}

describe('FilterDatePicker — app locale (F3.21)', () => {
  it('pl: the day reads 01.11.2026; the calendar is Polish, Monday first, Wyczyść / Dzisiaj', () => {
    renderPicker('pl', PL)
    const trigger = screen.getByRole('button', { name: 'Od' })
    expect(trigger).toHaveTextContent('01.11.2026')
    fireEvent.click(trigger)
    expect(screen.getByRole('status')).toHaveTextContent('listopad 2026')
    expect(weekdays()[0]).toBe('poniedziałek')
    expect(screen.getByRole('button', { name: 'Wyczyść' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dzisiaj' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('en keeps its own form', () => {
    renderPicker('en', {})
    expect(screen.getByRole('button', { name: 'Od' })).toHaveTextContent('2026-11-01')
  })
})
