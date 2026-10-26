/**
 * FMS acc-v17 F3.16 (22.10): in a Polish grid the date editor said 'RRRR-MM-DD' and a typed '21.10.2026' was never read
 * (new Date('21.10.2026') is no date). It shows and reads DD.MM.RRRR, saves the day as YYYY-MM-DD, and a cell left as
 * it was saves its own value back.
 */
import * as React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { I18nProvider } from '@open-mercato/shared/lib/i18n/context'
import { DateEditor } from '../components/editors'
import { parseTypedDate, typedDatePlaceholderFor } from '../../inputs/dateLocale'

function renderEditor(value: string, locale = 'pl') {
  const onSave = jest.fn()
  const Provider = I18nProvider as unknown as React.FC<{ locale: string; dict: Record<string, string>; children: React.ReactNode }>
  const { container } = render(
    <Provider locale={locale} dict={{}}>
      <DateEditor value={value} onChange={() => {}} onSave={onSave} onCancel={() => {}} inputRef={React.createRef()} />
    </Provider>,
  )
  return { textarea: container.querySelector('textarea') as HTMLTextAreaElement, onSave }
}

describe('DateEditor in a day-first language (F3.16)', () => {
  it('says DD.MM.RRRR and shows the day as 21.10.2026', () => {
    const { textarea } = renderEditor('2026-10-21')
    expect(textarea.placeholder).toBe('DD.MM.RRRR')
    expect(textarea.value).toBe('21.10.2026')
  })

  it('reads a typed DD.MM.RRRR as that day and saves it as YYYY-MM-DD', () => {
    const { textarea, onSave } = renderEditor('2026-10-21')
    fireEvent.change(textarea, { target: { value: '5.11.2026' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('2026-11-05', false)
  })

  it('a cell left as it was saves its own value back', () => {
    const { textarea, onSave } = renderEditor('2026-10-21T12:00:00.000Z')
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('2026-10-21T12:00:00.000Z', false)
  })

  it('English keeps the ISO form', () => {
    expect(typedDatePlaceholderFor('en')).toBe('YYYY-MM-DD')
    expect(renderEditor('2026-10-21', 'en').textarea.value).toBe('2026-10-21')
  })

  it('31.02.2026 is no day', () => {
    expect(parseTypedDate('31.02.2026')).toBeNull()
    expect(parseTypedDate('nie wiem')).toBeNull()
  })
})
