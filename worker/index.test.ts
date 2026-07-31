import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from './index'

const env: Env = { RESEND_API_KEY: 'test-key' }
const ctx = {} as ExecutionContext

function post(body: unknown): Request {
  return new Request('https://x/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = { counter_name: 'Bartek', counts: [{ id: 2565, amount: 1 }] }

afterEach(() => {
  vi.restoreAllMocks()
})

function mockResend(response: Response) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
}

describe('worker routing', () => {
  it('responds to /api/ping', async () => {
    const res = await worker.fetch(new Request('https://x/api/ping'), env, ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('404s unknown api routes', async () => {
    const res = await worker.fetch(new Request('https://x/api/nope'), env, ctx)
    expect(res.status).toBe(404)
  })

  it('405s GET on /api/send', async () => {
    const res = await worker.fetch(new Request('https://x/api/send'), env, ctx)
    expect(res.status).toBe(405)
  })
})

describe('POST /api/send', () => {
  it('envia el correo y devuelve ok', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    const res = await worker.fetch(post(validBody), env, ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledOnce()
  })

  it('manda a hello@anceu.com y desde no-reply@send.anceu.com', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    await worker.fetch(post(validBody), env, ctx)

    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const payload = JSON.parse(init.body as string)
    expect(payload.to).toEqual(['hello@anceu.com'])
    expect(payload.from).toBe('Suministros Anceu <no-reply@send.anceu.com>')
    expect(payload.subject).toContain('[Anceu] Supplies')
    expect(payload.text).toContain('Counted by: Bartek')
    expect(payload.html).toBeUndefined()
  })

  it('ignora cualquier destinatario que venga del cliente', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    await worker.fetch(post({ ...validBody, to: 'attacker@example.com' }), env, ctx)

    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string).to).toEqual(['hello@anceu.com'])
  })

  it('usa la api key del entorno como bearer', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    await worker.fetch(post(validBody), env, ctx)

    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('400 con un cuerpo invalido, sin llamar a Resend', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    const res = await worker.fetch(post({ counts: [{ id: 999, amount: 1 }] }), env, ctx)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('unknown product') })
    expect(spy).not.toHaveBeenCalled()
  })

  it('400 con json roto', async () => {
    const res = await worker.fetch(
      new Request('https://x/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      }),
      env,
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('502 si Resend falla, y no dice por que al cliente', async () => {
    mockResend(new Response('rate limited', { status: 429 }))
    const res = await worker.fetch(post(validBody), env, ctx)

    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: string }
    expect(body.error).not.toContain('rate limited')
  })

  it('500 si falta la api key', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    const res = await worker.fetch(post(validBody), { RESEND_API_KEY: '' }, ctx)

    expect(res.status).toBe(500)
    expect(spy).not.toHaveBeenCalled()
  })
})
