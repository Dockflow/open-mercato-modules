import * as React from 'react'
import { render, fireEvent, act } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import DynamicTable from '../DynamicTable'
import type { ColumnDef } from '../types/index'

/**
 * A table must not resize while someone works in it (owner, 23.10). Measured in the app: ticking a
 * row on a capped table made it 15 px taller for ~10 frames (the selection bar grew a frame before
 * the rows region gave way), and a search that narrowed the rows made a content-height table
 * shorter, then taller again when it was cleared. jsdom lays nothing out, so heights are set by hand
 * and the ResizeObserver is driven by the test.
 */

const columns: ColumnDef[] = [
  { data: 'client', title: 'Client' },
  { data: 'amount', title: 'Amount', type: 'numeric' },
]
const rows = [
  { id: '1', client: 'Acme', amount: 100 },
  { id: '2', client: 'Beta', amount: 250 },
]

const heights = new Map<string, number>()
const observers: Array<() => void> = []
const heightOf = (el: HTMLElement) => {
  if (el.classList.contains('hot-container')) return heights.get('frame') ?? 0
  if (el.classList.contains('hot-virtual-container')) return heights.get('rows') ?? 0
  if (el.classList.contains('hot-headers-sticky')) return heights.get('header') ?? 0
  return 0
}

beforeAll(() => {
  const rect = { width: 1200, height: 600, top: 0, left: 0, right: 1200, bottom: 600, x: 0, y: 0, toJSON() {} }
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => heights.get('width') ?? 1200 })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 1200 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      // A held element is at least its min-height, as in the browser.
      return Math.max(heightOf(this), parseFloat(this.style.minHeight) || 0)
    },
  })
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    private readonly targets: HTMLElement[] = []
    constructor(cb: (entries: unknown[], observer: unknown) => void) {
      observers.push(() => {
        if (this.targets.length === 0) return
        cb(this.targets.map((target) => {
          const size = { inlineSize: target.offsetWidth, blockSize: target.offsetHeight }
          return { target, contentRect: target.getBoundingClientRect(), borderBoxSize: [size], contentBoxSize: [size] }
        }), this)
      })
    }
    observe(el: HTMLElement) { this.targets.push(el) }
    unobserve() {}
    disconnect() { this.targets.length = 0 }
  }
})

beforeEach(() => {
  heights.clear()
  observers.length = 0
})

function Harness(props: Record<string, unknown>) {
  const tableRef = React.useRef<HTMLDivElement | null>(null)
  return React.createElement(
    I18nProvider as any,
    { locale: 'en', dict: {} },
    React.createElement(DynamicTable as any, { data: rows, columns, tableRef, rowHeaders: true, ...props }),
  )
}

const frame = () => document.querySelector('.hot-container') as HTMLElement
const rowsRegion = () => document.querySelector('.hot-virtual-container') as HTMLElement
const layoutChanged = () => act(() => observers.forEach((notify) => notify()))

describe('DynamicTable — ticking a row moves nothing', () => {
  it('the selection bar hangs over the header row, just above the rows region, and the cap stays whole', () => {
    heights.set('header', 34).set('frame', 348).set('rows', 250)
    render(React.createElement(Harness, { height: 'content', maxHeight: 250, rowSelection: true, onBulkDelete: jest.fn() }))
    fireEvent.click(document.querySelectorAll<HTMLInputElement>('td.hot-row-header input.hot-row-select')[0])
    const bar = document.querySelector('.hot-bulk-bar-wrap.is-open') as HTMLElement
    expect(bar.classList.contains('hot-bulk-bar-over-header')).toBe(true)
    expect(bar.nextElementSibling).toBe(rowsRegion())
    expect(frame().style.getPropertyValue('--hot-bulk-bar-height')).toBe('34px')
    // The rows region keeps its cap: nothing is taken off it for the bar.
    expect(rowsRegion().style.maxHeight).toBe('250px')
  })

  it('a table without a header row keeps the band above the rows', () => {
    heights.set('frame', 348).set('rows', 250)
    render(React.createElement(Harness, { colHeaders: false, rowSelection: true, onBulkDelete: jest.fn() }))
    expect(document.querySelector('.hot-bulk-bar-wrap')!.classList.contains('hot-bulk-bar-over-header')).toBe(false)
  })
})

describe('DynamicTable height="content" — no resize while someone works in it', () => {
  it('follows its rows until the first click, then never gets shorter', () => {
    heights.set('frame', 374).set('rows', 300)
    render(React.createElement(Harness, { height: 'content' }))
    // Still loading, nobody has touched the page: the table is free to follow its rows.
    heights.set('frame', 340).set('rows', 266)
    layoutChanged()
    expect(frame().style.minHeight).toBe('')

    fireEvent.pointerDown(document.body)
    expect(frame().style.minHeight).toBe('340px')
    expect(rowsRegion().style.minHeight).toBe('266px')

    // A search narrows the rows: the table holds its height.
    heights.set('frame', 160).set('rows', 90)
    layoutChanged()
    expect(frame().offsetHeight).toBe(340)
    expect(rowsRegion().offsetHeight).toBe(266)
  })

  it('still grows when its rows need the room, and holds that', () => {
    heights.set('frame', 200).set('rows', 130)
    render(React.createElement(Harness, { height: 'content' }))
    fireEvent.keyDown(document.body, { key: 'a' })
    heights.set('frame', 420).set('rows', 350)
    layoutChanged()
    expect(frame().style.minHeight).toBe('420px')
    heights.set('frame', 200).set('rows', 130)
    layoutChanged()
    expect(frame().offsetHeight).toBe(420)
  })

  it('lets go on a window resize and on a new width, holding what the new layout gives', () => {
    heights.set('frame', 374).set('rows', 300)
    render(React.createElement(Harness, { height: 'content' }))
    fireEvent.pointerDown(document.body)
    heights.set('frame', 200).set('rows', 130)
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(frame().style.minHeight).toBe('')

    fireEvent.pointerDown(document.body)
    expect(frame().style.minHeight).toBe('200px')
    heights.set('width', 900).set('frame', 180).set('rows', 110)
    layoutChanged()
    expect(frame().style.minHeight).toBe('180px')
  })

  it("a pane-capped table ('fill') holds its frame, and its rows region grows into it rather than shrinking inside", () => {
    // M23.26 (owner call 23.10): on e-Kancelaria the frame held but the grid inside went 215 → 85 px on a search.
    heights.set('frame', 300).set('rows', 215)
    render(React.createElement(Harness, { height: 'fill' }))
    fireEvent.pointerDown(document.body)
    expect(frame().style.minHeight).toBe('300px')
    expect(rowsRegion().style.flex).toBe('1 1 auto')
    const card = frame().querySelector('.hot-card')
    if (card) expect(card.className).toContain('grow')
  })

  it('a table with a height of its own is never held', () => {
    heights.set('frame', 374).set('rows', 300)
    render(React.createElement(Harness, { height: 400 }))
    fireEvent.pointerDown(document.body)
    expect(frame().style.minHeight).toBe('')
  })
})

describe('DynamicTable — switching views keeps column widths steady', () => {
  it('no task ends with the new view\'s columns at the old view\'s widths', async () => {
    // Narrow, so the fill adds nothing and the declared widths are what the headers show.
    heights.set('width', 100).set('frame', 200).set('rows', 130)
    const columns3: ColumnDef[] = [
      { data: 'client', title: 'Client', width: 120 },
      { data: 'amount', title: 'Amount', width: 200 },
      { data: 'note', title: 'Note', width: 80 },
    ]
    const view = (id: string, visible: string[], hidden: string[]) =>
      ({ id, name: id, columns: { visible, hidden }, filters: [], sorting: [] })
    const savedPerspectives = [view('two', ['client', 'amount'], ['note']), view('three', ['note', 'client', 'amount'], [])]
    const props = (activePerspectiveId: string) => ({ columns: columns3, savedPerspectives, activePerspectiveId, height: 400 })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const before = env.IS_REACT_ACT_ENVIRONMENT
    // Outside act(): React's work runs in its own tasks, as in a browser, and the page is painted between them.
    env.IS_REACT_ACT_ENVIRONMENT = false
    const root = createRoot(host)
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50))
    const widths = () => [...host.querySelectorAll<HTMLElement>('th.hot-col-header')].map((th) => th.style.width)
    const painted: string[][] = []
    const watch = new MutationObserver(() => painted.push(widths()))
    try {
      root.render(React.createElement(Harness, props('two')))
      await settle()
      expect(widths()).toEqual(['120px', '200px'])
      watch.observe(host, { subtree: true, childList: true, attributes: true })
      root.render(React.createElement(Harness, props('three')))
      await settle()
      expect(widths()).toEqual(['80px', '120px', '200px'])
      expect(painted.filter((w) => w.length === 3)).toEqual(painted.filter((w) => w.length === 3).map(() => ['80px', '120px', '200px']))
    } finally {
      watch.disconnect()
      root.unmount()
      host.remove()
      env.IS_REACT_ACT_ENVIRONMENT = before
    }
  })
})

describe('DynamicTable — a wider container fills its columns in the same frame', () => {
  it('the resize that makes room paints the columns already filled', async () => {
    heights.set('width', 100).set('frame', 200).set('rows', 130)
    const two: ColumnDef[] = [
      { data: 'client', title: 'Client', width: 120 },
      { data: 'amount', title: 'Amount', width: 200 },
    ]
    const host = document.createElement('div')
    document.body.appendChild(host)
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const before = env.IS_REACT_ACT_ENVIRONMENT
    env.IS_REACT_ACT_ENVIRONMENT = false
    const root = createRoot(host)
    const widths = () => [...host.querySelectorAll<HTMLElement>('th.hot-col-header')].map((th) => th.style.width)
    try {
      root.render(React.createElement(Harness, { columns: two, height: 400 }))
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(widths()).toEqual(['120px', '200px'])
      // The widget's box grows (it mounted narrow); the observer fires before the browser paints.
      heights.set('width', 1000)
      observers.forEach((notify) => notify())
      expect(widths()).not.toEqual(['120px', '200px'])
    } finally {
      root.unmount()
      host.remove()
      env.IS_REACT_ACT_ENVIRONMENT = before
    }
  })
})
