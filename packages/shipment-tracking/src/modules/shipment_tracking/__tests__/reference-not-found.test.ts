import { describe, it, expect, vi } from 'vitest'
import { TrackingService } from '../services/trackingService'
import { parseDcsaEvents } from '../lib/dcsa-event-parser'
import { CarrierReferenceNotFoundError, type CarrierFetchResult } from '../lib/carrier-adapter'
import { MscAdapter } from '../lib/adapters/msc'

/**
 * Reference-not-found detection (spec 2026-10-21-tracking-reference-not-found-detection).
 *
 * A carrier "not found" (thrown 404, or the silent 200+[] shape) must NOT be
 * retried to 'failed'. It stamps notFoundSince/notFoundCount and raises
 * shipment_tracking.tracking_job.reference_not_found once — on the crossing poll
 * (count threshold) or when the age/zero-events guard first trips.
 *
 * TC-TRACK-RNF-001 — thrown 404 → marked, not failed, event once at threshold.
 * TC-TRACK-RNF-002 — silent-empty + age guard → event once.
 * TC-TRACK-RNF-003 — fresh booking (young / below threshold) → NO event; data clears the mark.
 * TC-TRACK-RNF-008 — MSC.validateReference format check.
 */

const scope = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  organizationId: '00000000-0000-0000-0000-000000000002',
}

function createMockEm() {
  let counter = 0
  const jobs = new Map<string, any>()
  const shipments = new Map<string, any>()
  const events = new Map<string, any>()

  const em: any = {
    findOne: vi.fn(async (Entity: any, filter: any, options?: any) => {
      const name = typeof Entity === 'function' ? Entity.name : Entity?.name
      if (name === 'TrackingJob') {
        const job = jobs.get(filter.id)
        if (job && options?.populate) {
          job.shipments.set([...shipments.values()].filter((s) => s.trackingJob?.id === job.id))
        }
        return job ?? null
      }
      return null // CarrierConfig / BicConfig / LocationOverride not configured
    }),
    find: vi.fn(async (Entity: any, filter: any, options?: any) => {
      const name = typeof Entity === 'function' ? Entity.name : Entity?.name
      if (name === 'TrackingEvent') {
        let list = [...events.values()].filter((e) => e.trackingJob?.id === (filter.trackingJob?.id ?? filter.trackingJob))
        if (options?.orderBy?.eventDateTime === 'asc') {
          list = list.sort((a, b) => a.eventDateTime.getTime() - b.eventDateTime.getTime())
        }
        return list
      }
      if (name === 'Shipment') {
        return [...shipments.values()].filter((s) => s.trackingJob?.id === filter.trackingJob?.id && s.deletedAt == null)
      }
      return []
    }),
    count: vi.fn(async (Entity: any, filter: any) => {
      const name = typeof Entity === 'function' ? Entity.name : Entity?.name
      if (name === 'TrackingEvent') {
        const jobId = filter.trackingJob?.id ?? filter.trackingJob
        return [...events.values()].filter((e) => (e.trackingJob?.id ?? e.trackingJob) === jobId).length
      }
      return 0
    }),
    create: vi.fn((Entity: any, data: any) => {
      const id = data.id ?? `mock-${counter++}`
      const entity: any = { ...data, id, createdAt: new Date(), updatedAt: new Date() }
      const name = typeof Entity === 'function' ? Entity.name : Entity?.name
      if (name === 'TrackingEvent') events.set(id, entity)
      else if (name === 'Shipment') shipments.set(id, entity)
      return entity
    }),
    persist: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  }

  return { em, jobs, shipments, events }
}

type AdapterBehaviour =
  | { kind: 'throw-not-found' }
  | { kind: 'empty' }
  | { kind: 'events'; result: CarrierFetchResult }

function makeService(behaviour: AdapterBehaviour, jobOverrides: Record<string, unknown> = {}) {
  const { em, jobs } = createMockEm()
  const emitted: Array<{ event: string; payload: any }> = []

  const adapter = {
    carrierCode: 'msc',
    supportedReferenceTypes: ['container', 'booking', 'bol'],
    fetchEvents: vi.fn(async () => {
      if (behaviour.kind === 'throw-not-found') {
        throw new CarrierReferenceNotFoundError({ carrierCode: 'msc', referenceType: 'bol', referenceValue: 'SBLNGB26000914' })
      }
      if (behaviour.kind === 'empty') return { events: [] }
      return behaviour.result
    }),
    testConnection: vi.fn(),
  }

  const service = new TrackingService({
    em: () => em,
    eventBus: { emit: vi.fn((event: string, payload: any) => { emitted.push({ event, payload }); return Promise.resolve() }), on: vi.fn() } as any,
    carrierRegistry: { get: (code: string) => (code === 'msc' ? adapter : undefined) } as any,
    cacheService: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), incr: vi.fn() } as any,
    webhookService: { dispatchEvent: vi.fn(), dispatchWithRetry: vi.fn(), buildFullShipmentPayload: vi.fn() } as any,
  })

  const job: any = {
    id: 'job-1',
    ...scope,
    carrierCode: 'msc',
    referenceType: 'bol',
    referenceValue: 'SBLNGB26000914',
    status: 'active',
    retryCount: 0,
    notFoundCount: 0,
    notFoundSince: null,
    createdAt: new Date(),
    nextPollAt: new Date(),
    shipments: { set: vi.fn(), getItems: () => [] },
    events: { set: vi.fn(), getItems: () => [] },
    deletedAt: null,
    ...jobOverrides,
  }
  jobs.set(job.id, job)
  return { service, job, emitted }
}

const RNF = 'shipment_tracking.tracking_job.reference_not_found'

describe('reference-not-found detection (pollTrackingJob)', () => {
  it('TC-TRACK-RNF-001: thrown 404 marks the job and emits once at the threshold, never failing it', async () => {
    const { service, job, emitted } = makeService({ kind: 'throw-not-found' })

    // Threshold is 3 (default). Poll three times.
    await service.pollTrackingJob(job.id)
    await service.pollTrackingJob(job.id)
    expect(emitted.filter((e) => e.event === RNF)).toHaveLength(0) // not yet
    await service.pollTrackingJob(job.id)

    expect(job.notFoundCount).toBe(3)
    expect(job.notFoundSince).toBeInstanceOf(Date)
    expect(job.status).toBe('active') // NOT 'failed'
    expect(job.retryCount).toBe(0) // retry budget untouched
    const rnf = emitted.filter((e) => e.event === RNF)
    expect(rnf).toHaveLength(1)
    expect(rnf[0].payload).toMatchObject({
      id: job.id,
      referenceType: 'bol',
      referenceValue: 'SBLNGB26000914',
      notFoundCount: 3,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    // A fourth poll must NOT re-emit.
    await service.pollTrackingJob(job.id)
    expect(emitted.filter((e) => e.event === RNF)).toHaveLength(1)
  })

  it('TC-TRACK-RNF-002: silent-empty + age guard raises the signal once', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const { service, job, emitted } = makeService({ kind: 'empty' }, { createdAt: threeDaysAgo })

    await service.pollTrackingJob(job.id)

    expect(job.status).toBe('active')
    expect(job.notFoundSince).toBeInstanceOf(Date)
    expect(emitted.filter((e) => e.event === RNF)).toHaveLength(1)

    // Next empty poll: notFoundSince already set → no duplicate emit.
    await service.pollTrackingJob(job.id)
    expect(emitted.filter((e) => e.event === RNF)).toHaveLength(1)
  })

  it('TC-TRACK-RNF-003: a fresh booking returning empty does NOT false-alarm', async () => {
    const { service, job, emitted } = makeService({ kind: 'empty' }, { createdAt: new Date() })

    await service.pollTrackingJob(job.id)

    expect(job.notFoundSince).toBeNull()
    expect(emitted.filter((e) => e.event === RNF)).toHaveLength(0)
  })

  it('TC-TRACK-RNF-003b: real events clear a prior not-found mark', async () => {
    const events = parseDcsaEvents(
      [{
        eventType: 'TRANSPORT',
        transportEventTypeCode: 'ARRI',
        eventId: 'evt-arri-1',
        eventDateTime: '2026-09-11T10:00:00Z',
        eventClassifierCode: 'ACT',
        transportCall: { location: { unLocationCode: 'SGSIN', locationName: 'Singapore' } },
      }] as any,
      'MSC',
    )
    const { service, job } = makeService(
      { kind: 'events', result: { events, bookingNumber: null, bolNumber: null } },
      { notFoundCount: 2, notFoundSince: new Date() },
    )

    await service.pollTrackingJob(job.id)

    expect(job.notFoundSince).toBeNull()
    expect(job.notFoundCount).toBe(0)
  })
})

describe('MscAdapter.validateReference (TC-TRACK-RNF-008)', () => {
  const msc = new MscAdapter()

  it('rejects a house/seaway BL as an MSC reference', () => {
    expect(msc.validateReference({ referenceType: 'bol', referenceValue: 'SBLNGB26000914' })).toMatchObject({ ok: false })
  })
  it('accepts a genuine MEDU… BOL', () => {
    expect(msc.validateReference({ referenceType: 'bol', referenceValue: 'MEDUACP94636' })).toEqual({ ok: true })
  })
  it('accepts a numeric booking', () => {
    expect(msc.validateReference({ referenceType: 'booking', referenceValue: '123456789' })).toEqual({ ok: true })
  })
  it('validates container as ISO 6346', () => {
    expect(msc.validateReference({ referenceType: 'container', referenceValue: 'MSMU5799679' })).toEqual({ ok: true })
    expect(msc.validateReference({ referenceType: 'container', referenceValue: 'NOPE' })).toMatchObject({ ok: false })
  })
})
