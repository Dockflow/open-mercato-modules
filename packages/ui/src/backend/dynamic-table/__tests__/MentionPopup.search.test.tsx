/**
 * @mention user lookup — FMS messaging 1.4 (carried from FMS's 0.14.21 patch into 0.14.22).
 *
 * The popup used to read `/api/auth/users`, which needs `auth.users.list` (admins only): every other commenter got a
 * 403 that sent them to the login page. It now reads `/api/annotations/users` — the people any commenter may
 * mention — with `search=` matching name or e-mail, diacritics ignored, on the server. One request per query, and a
 * refusal leaves the list empty instead of redirecting.
 */
import * as React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import MentionPopup from '../components/MentionPopup'

jest.mock('../../utils/api', () => ({
  apiFetch: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiFetch } = require('../../utils/api') as { apiFetch: jest.Mock }

const USERS = [
  { id: 'u1', name: 'Łukasz Kowalski', email: 'seed-rep-1@offdock.test' },
  { id: 'u2', name: 'Daria Nowak', email: 'seed-rep-2@offdock.test' },
  { id: 'u3', name: 'Karol Wiśniewski', email: 'seed-rep-3@offdock.test' },
]

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase()

/** Stands in for the route: `search=` matches name or e-mail, diacritics ignored. */
function serveLikeTheRoute(url: string) {
  const search = new URL(url, 'http://localhost').searchParams.get('search')
  const items = search ? USERS.filter((u) => fold(u.name).includes(fold(search)) || fold(u.email).includes(fold(search))) : USERS
  return { ok: true, json: async () => ({ items }) }
}

function renderPopup(query: string) {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  return render(
    <MentionPopup
      query={query}
      anchorEl={anchor}
      visible
      onSelect={() => {}}
      onClose={() => {}}
    />,
  )
}

describe('MentionPopup — the people a commenter may mention', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    apiFetch.mockReset()
    apiFetch.mockImplementation((url: string) => Promise.resolve(serveLikeTheRoute(url)))
  })
  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  // The popup debounces 250 ms and then resolves promises; both the timer and
  // the microtask drain have to run inside `act` or React warns about the
  // state updates that land after them.
  const flush = async () => {
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(apiFetch).toHaveBeenCalled()
  }

  it('asks the annotations users route with `search=`, and a refusal does not redirect to the login page', async () => {
    renderPopup('Daria')
    await flush()
    const [url, init] = apiFetch.mock.calls[0] as [string, { headers?: Record<string, string> }]
    expect(url).toMatch(/^\/api\/annotations\/users\?/)
    expect(url).toContain('search=Daria')
    expect(url).toContain('limit=10')
    expect(init?.headers?.['x-om-forbidden-redirect']).toBe('0')
    await waitFor(() => expect(screen.getByText('Daria Nowak')).toBeTruthy())
  })

  it('shows whom the server matched — "Lukasz" finds "Łukasz", an e-mail finds its user — in ONE request', async () => {
    renderPopup('Lukasz')
    await flush()
    await waitFor(() => expect(screen.getByText('Łukasz Kowalski')).toBeTruthy())
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('matches an e-mail', async () => {
    renderPopup('seed-rep-3')
    await flush()
    await waitFor(() => expect(screen.getByText('Karol Wiśniewski')).toBeTruthy())
  })

  it('still says so when nobody matches at all', async () => {
    renderPopup('Zzzz')
    await flush()
    await waitFor(() => expect(screen.getByText('No users found')).toBeTruthy())
  })

  it('a refused lookup leaves the list empty', async () => {
    apiFetch.mockImplementation(() => Promise.resolve({ ok: false, status: 403, json: async () => ({}) }))
    renderPopup('Daria')
    await flush()
    await waitFor(() => expect(screen.getByText('No users found')).toBeTruthy())
  })
})
