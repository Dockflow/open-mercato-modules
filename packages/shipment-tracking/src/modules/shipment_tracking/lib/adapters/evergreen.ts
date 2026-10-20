import type { CarrierAdapter, CarrierFetchResult, CarrierAdapterTestResult } from '../carrier-adapter'
import { extractDocumentReferences } from '../carrier-adapter'
import type { TrackingReferenceType } from '../../data/entities'
import { fetchOAuthToken } from '../auth/oauth-client'
import { buildDcsaQueryParams } from '../dcsa-params'
import { parseDcsaEvents } from '../dcsa-event-parser'
import { withCarrierApiSpan } from '../logger'

type EvergreenAuthConfig = {
  client_id: string
  client_secret: string
  token_url: string
}

function getAuth(authConfig: Record<string, unknown> | null | undefined): EvergreenAuthConfig {
  const clientId = authConfig?.client_id as string | undefined
  const clientSecret = authConfig?.client_secret as string | undefined
  const tokenUrl = authConfig?.token_url as string | undefined
  if (!clientId || !clientSecret || !tokenUrl) {
    throw new Error('Evergreen authConfig requires client_id, client_secret, and token_url')
  }
  return { client_id: clientId, client_secret: clientSecret, token_url: tokenUrl }
}

async function authenticate(auth: EvergreenAuthConfig): Promise<string> {
  return withCarrierApiSpan(
    { carrierCode: 'evergreen', operation: 'authenticate' },
    async (span) => {
      const token = await fetchOAuthToken({
        tokenUrl: auth.token_url,
        clientId: auth.client_id,
        clientSecret: auth.client_secret,
        authMethod: 'basic',
        extraBody: { scope: 'TNT' },
      })
      return token
    },
  )
}

export class EvergreenAdapter implements CarrierAdapter {
  readonly carrierCode = 'evergreen'
  readonly supportedReferenceTypes: TrackingReferenceType[] = ['container', 'booking', 'bol']

  async fetchEvents(input: {
    referenceType: TrackingReferenceType
    referenceValue: string
    apiEndpoint?: string | null
    authConfig?: Record<string, unknown> | null
  }): Promise<CarrierFetchResult> {
    return withCarrierApiSpan(
      {
        carrierCode: this.carrierCode,
        operation: 'fetchEvents',
        referenceType: input.referenceType,
        referenceValue: input.referenceValue,
      },
      async (span) => {
        const auth = getAuth(input.authConfig)
        const token = await authenticate(auth)
        const params = buildDcsaQueryParams(input.referenceValue, input.referenceType)
        // `apiEndpoint` is the FULL Track & Trace events URL (every other carrier
        // adapter treats it the same way) — not a host base. Do NOT append a path:
        // a configured full URL would double-append (…/apimg/tnt/v2/events +
        // apimg/tnt/v2/events → 404). Onboarding gives e.g.
        // https://qaews.switch-hub.com/server/sol/apimg/tnt/v2/events
        if (!input.apiEndpoint) {
          throw new Error('Evergreen requires apiEndpoint to be configured (the full Track & Trace events URL from onboarding, e.g. https://qaews.switch-hub.com/server/sol/apimg/tnt/v2/events)')
        }
        const url = `${input.apiEndpoint}?${params}`

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'API-Version': '2.2',
            'Content-Type': 'application/json',
          },
        })

        span.setAttribute('http.status_code', response.status)

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'unknown')
          throw new Error(`Evergreen API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        const events = parseDcsaEvents(data, 'Evergreen')
        const { bookingNumber, bolNumber } = extractDocumentReferences(events)

        span.setAttribute('events.count', events.length)
        return { events, bookingNumber, bolNumber }
      },
    )
  }

  async testConnection(input: {
    apiEndpoint?: string | null
    authConfig?: Record<string, unknown> | null
  }): Promise<CarrierAdapterTestResult> {
    const start = Date.now()
    try {
      const auth = getAuth(input.authConfig)
      await authenticate(auth)
      return { success: true, message: 'Evergreen authentication successful', latencyMs: Date.now() - start }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, message: `Evergreen connection failed: ${message}`, latencyMs: Date.now() - start }
    }
  }
}
