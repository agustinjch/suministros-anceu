import { describe, expect, it } from 'vitest'
import worker, { type Env } from './index'

const env = {} as Env
const ctx = {} as ExecutionContext

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
})
