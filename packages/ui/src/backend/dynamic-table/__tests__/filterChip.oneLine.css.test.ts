import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Owner call 23.10 (FMS acc-v17 M23.15, "ten peel wygląda bardzo źle"): a filter chip was cut mid-word — the chip was
 * capped at 220px and its label could not shrink, so a long name ("Kwota do zapłaty w walucie faktury") ran out of the
 * pill, and the strip of chips, capped at 360px, hid the rest behind a scroll with no scrollbar. A chip is one whole
 * line — its label whole, only a long value ellipsised — and on a wide table the toolbar wraps when the chips do not
 * fit, instead of clipping them. A narrow pane (≤720px) keeps its one-row toolbar: there the strip still scrolls.
 */
const searchBar = readFileSync(join(__dirname, '../styles/SearchBar.css'), 'utf8')
const v2 = readFileSync(join(__dirname, '../styles/DynamicTable.v2.css'), 'utf8')

const narrowStart = v2.indexOf('@container dt-grid (max-width: 720px)')
const narrowEnd = v2.indexOf('@container dt-grid (max-width: 520px)')
const wide = v2.slice(0, narrowStart) + v2.slice(narrowEnd)
const narrow = v2.slice(narrowStart, narrowEnd)

// Comments and the @container header out, so each selector stands before its own block.
const rule = (css: string, selector: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@container[^{]*\{/g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, sel]) => sel.split(',').some((s) => s.trim() === selector))
    .map(([, , body]) => body)
    .join('\n')

describe('a filter chip stays one whole line (M23.15)', () => {
  it('the chip, its label and its value never break into a second line', () => {
    expect(rule(searchBar, '.hot-filter-chip')).toMatch(/white-space:\s*nowrap/)
    expect(rule(searchBar, '.hot-filter-chip-label')).toMatch(/white-space:\s*nowrap/)
    expect(rule(searchBar, '.hot-filter-chip-value')).toMatch(/white-space:\s*nowrap/)
  })

  it('the label is whole: no cap on the chip that pushes it out of the pill; a long value is ellipsised', () => {
    expect(rule(searchBar, '.hot-filter-chip')).not.toMatch(/max-width/)
    expect(rule(searchBar, '.hot-filter-chip-label')).toMatch(/flex:\s*0 0 auto/)
    expect(rule(searchBar, '.hot-filter-chip-value')).toMatch(/max-width:\s*\d+px/)
    expect(rule(searchBar, '.hot-filter-chip-value')).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('on a wide table the chips are not clipped: the strip wraps, and so do the toolbar and its actions', () => {
    const strip = rule(searchBar, '.hot-filter-chips')
    expect(strip).toMatch(/flex-wrap:\s*wrap/)
    expect(strip).not.toMatch(/max-width/)
    expect(strip).not.toMatch(/overflow-x:\s*auto/)
    expect(rule(wide, '.hot-appearance-v2 .hot-toolbar')).toMatch(/flex-wrap:\s*wrap/)
    expect(rule(wide, '.hot-appearance-v2 .hot-toolbar .hot-toolbar-actions')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('a narrow pane keeps one toolbar row; there the strip scrolls', () => {
    expect(rule(narrow, '.hot-appearance-v2 .hot-toolbar')).toMatch(/flex-wrap:\s*nowrap/)
    const strip = rule(narrow, '.hot-appearance-v2 .hot-toolbar .hot-filter-chips')
    expect(strip).toMatch(/flex-wrap:\s*nowrap/)
    expect(strip).toMatch(/overflow-x:\s*auto/)
  })
})
