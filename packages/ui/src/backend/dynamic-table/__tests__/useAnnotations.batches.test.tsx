import { renderHook, waitFor } from '@testing-library/react'
import { useAnnotations } from '../hooks/useAnnotations'
import { apiCall } from '../../utils/apiCall'

jest.mock('../../utils/apiCall', () => ({ apiCall: jest.fn() }))

const apiCallMock = apiCall as unknown as jest.Mock

/**
 * FMS CR13 (22.10): a table read the marks of all its rows in ONE GET, every row id in the query string. On a large
 * desk that ran past Node's 16 KiB request-header limit (a UUID and its comma are 37 bytes), and FMS raised the
 * server's limit to 1 MiB to keep the marks. The ids now go in parts of at most 300 per request, the answers merged.
 */
describe('useAnnotations — row ids in parts', () => {
  beforeEach(() => {
    apiCallMock.mockReset()
    apiCallMock.mockImplementation(async (url: string) => {
      const ids = (new URL(url, 'http://localhost').searchParams.get('rowIds') ?? '').split(',')
      // Every row has a red mark on its "note" cell.
      return { ok: true, result: { items: ids.map((rowId) => ({ id: `a-${rowId}`, rowId, columnKey: 'note', color: 'red', comments: [] })) } }
    })
  })

  it('650 rows are read in three requests of at most 300 ids, and every mark arrives', async () => {
    const targets = Array.from({ length: 650 }, (_, i) => ({ entityType: 'invoicing:invoice', rowId: `row-${i}` }))
    const { result } = renderHook(() => useAnnotations({ enabled: true, targets }))

    await waitFor(() => expect(result.current.annotations.size).toBe(650))
    expect(apiCallMock).toHaveBeenCalledTimes(3)
    const parts = apiCallMock.mock.calls.map(([url]) => (new URL(String(url), 'http://localhost').searchParams.get('rowIds') ?? '').split(','))
    expect(parts.map((p) => p.length)).toEqual([300, 300, 50])
    expect(new Set(parts.flat()).size).toBe(650)
  })

  it('a small table still costs one request', async () => {
    const targets = [{ entityType: 'invoicing:invoice', rowId: 'row-a' }, { entityType: 'invoicing:invoice', rowId: 'row-b' }]
    const { result } = renderHook(() => useAnnotations({ enabled: true, targets }))
    await waitFor(() => expect(result.current.annotations.size).toBe(2))
    expect(apiCallMock).toHaveBeenCalledTimes(1)
  })
})
