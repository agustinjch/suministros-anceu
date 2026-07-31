import { buildEmail } from '../src/lib/email'
import type { Product } from '../src/lib/types'
import products from '../src/products.json'
import { ValidationError, parseSendRequest } from './validate'

export interface Env {
  RESEND_API_KEY: string
}

const CATALOG = products as Product[]
const VALID_IDS = new Set(CATALOG.map((p) => p.id))

/**
 * Fijos a propósito. El endpoint está abierto en internet: si el destinatario
 * llegase del cliente, esto sería un relay de spam firmado con el dominio de
 * Anceu.
 */
const TO = 'hello@anceu.com'
const FROM = 'Suministros Anceu <no-reply@send.anceu.com>'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

async function handleSend(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY no configurada')
    return Response.json({ error: 'server misconfigured' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  let parsed: ReturnType<typeof parseSendRequest>
  try {
    parsed = parseSendRequest(body, VALID_IDS)
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    throw error
  }

  const { subject, text } = buildEmail(CATALOG, parsed.counts, parsed.counter_name, new Date())

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, text }),
  })

  if (!res.ok) {
    // El detalle va al log, no al cliente: puede filtrar la configuración de Resend.
    console.error(`Resend ${res.status}: ${await res.text()}`)
    return Response.json({ error: 'could not send email' }, { status: 502 })
  }

  // El id de Resend al log: es lo único con lo que rastrear después un envío
  // concreto ("¿se mandó el inventario del martes?") en el panel de Resend.
  const sent = (await res.json().catch(() => null)) as { id?: string } | null
  console.log(`Resend ok id=${sent?.id ?? 'unknown'} toBuy=${subject}`)

  return Response.json({ ok: true })
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/ping') {
      return Response.json({ ok: true })
    }

    if (url.pathname === '/api/send') {
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { allow: 'POST' } })
      }
      return handleSend(request, env)
    }

    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
