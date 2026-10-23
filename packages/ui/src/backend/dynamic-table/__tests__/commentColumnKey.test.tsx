import * as React from 'react'
import { render, waitFor } from '@testing-library/react'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import DynamicTable from '../DynamicTable'
import type { ColumnDef } from '../types/index'

/**
 * G23.09 (owner, GT 23.10 [00:14:01]: "żeby one się też przenosiły … pomiędzy różnymi tabelami"): a colour or comment
 * put on an invoice in one table shows on the same invoice in another — even where that table names the column
 * differently ("Do zapłaty" here is the invoice's gross amount there). `commentsCellTarget` may name the column the mark
 * is about; the grid reads, shows and writes the mark under that name. Synthetic rows.
 */

let requested: string[] = []

jest.mock('../../utils/apiCall', () => ({
  apiCall: jest.fn(async (url: string) => {
    const parsed = new URL(url, 'http://localhost')
    if (!parsed.pathname.startsWith('/api/annotations/annotations')) return { ok: true, result: {} }
    const entityType = parsed.searchParams.get('entityType') ?? ''
    requested.push(entityType)
    const rowIds = (parsed.searchParams.get('rowIds') ?? '').split(',').filter(Boolean)
    // Marked in "Dokumenty księgowe": the gross amount of invoice inv-1, yellow, with one comment.
    const items =
      entityType === 'invoicing:invoice' && rowIds.includes('inv-1')
        ? [{ id: 'a1', entityType, rowId: 'inv-1', columnKey: 'grossAmount', color: 'yellow', comments: [{ id: 'c1', content: 'sprawdzić', audience: 'internal' }], assignees: [] }]
        : []
    return { ok: true, result: { items } }
  }),
}))

/** "Sprzedaż": the same invoices, its own column names. */
const columns: ColumnDef[] = [
  { data: 'invoiceNumber', title: 'Faktura' },
  { data: 'amountDue', title: 'Do zapłaty' },
]
const rows = [{ id: 'inv-1', invoiceNumber: 'FV/2026/10/001', amountDue: '1230.00' }]
const INVOICE_COLUMNS: Record<string, string> = { amountDue: 'grossAmount' }

function Harness(props: Record<string, unknown>) {
  const tableRef = React.useRef<HTMLDivElement | null>(null)
  return React.createElement(
    I18nProvider as any,
    { locale: 'en', dict: {} },
    React.createElement(DynamicTable as any, { data: rows, columns, tableRef, height: 400, enableComments: true, ...props }),
  )
}

beforeAll(() => {
  const rect = { width: 1200, height: 600, top: 0, left: 0, right: 1200, bottom: 600, x: 0, y: 0, toJSON() {} }
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect })
  for (const [prop, value] of [['clientHeight', 600], ['offsetHeight', 600], ['clientWidth', 1200], ['offsetWidth', 1200]] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => value })
  }
})
beforeEach(() => {
  requested = []
})

const cell = (col: number) => document.querySelector<HTMLElement>(`td.hot-cell[data-row="0"][data-col="${col}"]`)

describe('a mark follows the invoice across tables (G23.09)', () => {
  it("shows the invoice's gross-amount mark on this table's \"Do zapłaty\", not on its number", async () => {
    render(
      React.createElement(Harness, {
        commentsCellTarget: (row: Record<string, any>, col: ColumnDef) => ({ entityType: 'invoicing:invoice', rowId: String(row.id), columnKey: INVOICE_COLUMNS[col.data] ?? col.data }),
      }),
    )
    await waitFor(() => expect(cell(1)?.className).toContain('cell-color-yellow'))
    expect(requested).toContain('invoicing:invoice')
    expect(cell(1)?.querySelector('.cell-comment-indicator:not(.cell-comment-indicator-ghost)')).not.toBeNull()
    expect(cell(0)?.className).not.toContain('cell-color-')
  })

  it('without a column name the mark stays where the grid keys it (its own column)', async () => {
    render(React.createElement(Harness, { commentsCellTarget: (row: Record<string, any>) => ({ entityType: 'invoicing:invoice', rowId: String(row.id) }) }))
    await waitFor(() => expect(requested).toContain('invoicing:invoice'))
    expect(cell(1)?.className).not.toContain('cell-color-')
  })
})
