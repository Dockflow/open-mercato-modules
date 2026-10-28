/**
 * @jest-environment jsdom
 *
 * WHERE THE TABLE'S SETTINGS MENU SITS.
 *
 * GT (28.10) took the toolbar's `⋯` for one of the page's action buttons, and found only the row height
 * behind it: "przenieśmy ją za paginację … nie miesza się z przyciskami, które wykonują jakąś akcję".
 * An app may therefore move the menu after the pagination, as a settings button. The default must not
 * move: every FMS table keeps its `⋯` in the toolbar until it opts in.
 */

import * as React from 'react'
import { render } from '@testing-library/react'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import DynamicTable from '../DynamicTable'
import { DynamicTableDefaultsProvider } from '../index'
import { apiCall } from '@freighttech/ui/backend/utils/apiCall'
import type { ColumnDef, PaginationProps } from '../types/index'

jest.mock('@freighttech/ui/backend/utils/apiCall', () => ({
  apiCall: jest.fn(),
}))
const mockApiCall = apiCall as unknown as jest.Mock

const columns: ColumnDef[] = [{ data: 'name', title: 'Name', width: 200 }]
const pagination: PaginationProps = {
  currentPage: 1,
  totalPages: 3,
  limit: 50,
  total: 120,
  onPageChange: () => {},
  onLimitChange: () => {},
}

/** `ui` is the table's `uiConfig` (where the toolbar options live). */
function Table({ ui }: { ui: Record<string, unknown> }) {
  const tableRef = React.useRef<HTMLDivElement | null>(null)
  const [data] = React.useState(() => [{ id: 'r1', name: 'AMICA' }])
  return React.createElement(DynamicTable as any, { data, columns, tableRef, height: 400, pagination, uiConfig: ui })
}

function mount(ui: Record<string, unknown> = {}, defaults?: { tableMenuPlacement?: 'toolbar' | 'pagination' }) {
  const table = React.createElement(Table, { ui })
  const tree = defaults ? React.createElement(DynamicTableDefaultsProvider, { value: defaults }, table) : table
  return render(React.createElement(I18nProvider as any, { locale: 'en', dict: {} }, tree))
}

const menu = () => document.querySelector('[data-toolbar-overflow]') as HTMLElement | null
const inToolbar = () => !!menu()?.closest('.hot-toolbar')
const inTabsRow = () => !!menu()?.closest('.hot-tabs-row')
const afterPagination = () => {
  const pager = document.querySelector('.hot-tabs-row .hot-table-pagination')
  const button = menu()
  return !!pager && !!button && !!(pager.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING)
}

beforeEach(() => {
  mockApiCall.mockReset()
  mockApiCall.mockResolvedValue({ ok: false })
})

describe('the table settings menu', () => {
  it('stays in the toolbar as `⋯` by default', () => {
    mount()
    expect(inToolbar()).toBe(true)
    expect(inTabsRow()).toBe(false)
    expect(menu()?.getAttribute('data-toolbar-overflow-look')).toBe('more')
  })

  it('moves after the pagination as a settings button when the table asks for it', () => {
    mount({ tableMenuPlacement: 'pagination' })
    expect(inToolbar()).toBe(false)
    expect(afterPagination()).toBe(true)
    expect(menu()?.getAttribute('data-toolbar-overflow-look')).toBe('settings')
    expect(menu()?.getAttribute('aria-label')).toBe('Table settings')
    expect(document.querySelectorAll('[data-toolbar-overflow]')).toHaveLength(1)
  })

  it('moves for every table under an app default, and a table\'s own prop still wins', () => {
    const first = mount({}, { tableMenuPlacement: 'pagination' })
    expect(afterPagination()).toBe(true)
    first.unmount()
    mount({ tableMenuPlacement: 'toolbar' }, { tableMenuPlacement: 'pagination' })
    expect(inToolbar()).toBe(true)
  })

  it('stays in the toolbar when there is no tabs row to hold it', () => {
    mount({ tableMenuPlacement: 'pagination', hidePerspectiveTabs: true, hidePagination: true })
    expect(inToolbar()).toBe(true)
    expect(menu()?.getAttribute('data-toolbar-overflow-look')).toBe('more')
  })
})
