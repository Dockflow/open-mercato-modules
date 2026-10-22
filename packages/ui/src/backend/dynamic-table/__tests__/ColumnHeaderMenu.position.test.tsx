/**
 * G18 (FMS acc-v17, 22.10): the ⋮ menu of a table's last column opened past the window's right edge. The menu was
 * clamped in render through its ref — null on the first render — so it took the header's left and stayed there until
 * something re-rendered it. It is measured once drawn now, before the browser paints.
 */
import * as React from 'react'
import { render } from '@testing-library/react'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import ColumnHeaderMenu from '../components/ColumnHeaderMenu'

const MENU_WIDTH = 180

function anchorAt(left: number): DOMRect {
  return { left, right: left + 120, top: 40, bottom: 76, width: 120, height: 36, x: left, y: 40, toJSON: () => ({}) } as DOMRect
}

function renderMenu(anchorLeft: number) {
  const noop = () => {}
  const Provider = I18nProvider as unknown as React.FC<{ locale: string; dict: Record<string, string>; children: React.ReactNode }>
  render(
    <Provider locale="en" dict={{}}>
      <ColumnHeaderMenu
        column={{ data: 'acceptedAt', title: 'Zaakceptowana', type: 'date' } as never}
        colIndex={7}
        anchorRect={anchorAt(anchorLeft)}
        isFrozen={false}
        onSortAsc={noop}
        onSortDesc={noop}
        onFilterByField={noop}
        onFreezeToggle={noop}
        onHideField={noop}
        onClose={noop}
      />
    </Provider>,
  )
  return document.body.querySelector('.hot-col-menu') as HTMLElement
}

describe('ColumnHeaderMenu — opens inside the window', () => {
  const realRect = Element.prototype.getBoundingClientRect
  beforeAll(() => {
    // jsdom lays nothing out: the menu measures as its CSS min-width does in a browser.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList.contains('hot-col-menu')) return { ...anchorAt(0), width: MENU_WIDTH, right: MENU_WIDTH } as DOMRect
      return realRect.call(this)
    }
  })
  afterAll(() => {
    Element.prototype.getBoundingClientRect = realRect
  })
  beforeEach(() => {
    document.body.innerHTML = ''
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  })

  it("a last column's menu keeps its right edge 8 px inside the window from the first paint", () => {
    const menu = renderMenu(1130)
    expect(menu.style.left).toBe(`${1280 - MENU_WIDTH - 8}px`)
  })

  it('a menu with room opens under its header', () => {
    const menu = renderMenu(300)
    expect(menu.style.left).toBe('300px')
    expect(menu.style.top).toBe('80px')
  })
})
