/**
 * FMS acc-v17 F3.07 (22.10): the invoice list's "Sprzedaż wg rodzaju" view showed the chip "Typ outgoing" — the code the
 * filter keeps — in a Polish screen whose cells say "Przychód". A chip names each value as its column's options do.
 */
import * as React from 'react'
import { render } from '@testing-library/react'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import ActiveFilterChips, { filterValueLabel } from '../components/ActiveFilterChips'

const direction = {
  data: 'direction',
  title: 'Typ',
  source: [
    { value: 'outgoing', label: 'Przychód' },
    { value: 'incoming', label: 'Koszt' },
  ],
}

describe('ActiveFilterChips — values read as the column shows them', () => {
  it("a chip says the option's label, not its code", () => {
    const Provider = I18nProvider as unknown as React.FC<{ locale: string; dict: Record<string, string>; children: React.ReactNode }>
    const { container } = render(
      <Provider locale="pl" dict={{}}>
        <ActiveFilterChips
          filters={[{ id: 'f1', field: 'direction', operator: 'is_any_of', values: ['outgoing'] } as never]}
          columns={[direction as never]}
          onRemove={() => {}}
        />
      </Provider>,
    )
    expect(container.querySelector('.hot-filter-chip-label')?.textContent).toBe('Typ')
    expect(container.querySelector('.hot-filter-chip-value')?.textContent).toBe('Przychód')
  })

  it('a value with no option, or a column with no options, reads as itself', () => {
    expect(filterValueLabel(direction as never, 'incoming')).toBe('Koszt')
    expect(filterValueLabel(direction as never, 'proforma')).toBe('proforma')
    expect(filterValueLabel({ source: ['PLN', 'USD'] } as never, 'PLN')).toBe('PLN')
    expect(filterValueLabel(undefined, 'abc')).toBe('abc')
  })
})
