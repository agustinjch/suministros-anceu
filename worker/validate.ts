import type { CountEntry, SendRequest } from '../src/lib/types'

/** Tope defensivo: nadie tiene 10.000 rollos de papel. */
const MAX_AMOUNT = 10_000
const MAX_NAME = 80

export class ValidationError extends Error {}

function fail(message: string): never {
  throw new ValidationError(message)
}

/**
 * El endpoint está abierto en internet, así que no se confía en nada del
 * cliente: sólo ids del catálogo, cantidades enteras y acotadas, y un tope de
 * entradas. El destinatario del correo NO viaja en el cuerpo — está fijo en
 * `worker/index.ts`.
 */
export function parseSendRequest(body: unknown, validIds: Set<number>): SendRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    fail('body must be an object')
  }
  const raw = body as Record<string, unknown>

  const nameRaw = raw.counter_name ?? ''
  if (typeof nameRaw !== 'string') fail('counter_name must be a string')
  const counter_name = nameRaw.trim().slice(0, MAX_NAME)

  if (!Array.isArray(raw.counts)) fail('counts must be an array')
  if (raw.counts.length === 0) fail('counts must not be empty')
  if (raw.counts.length > validIds.size) fail('too many counts')

  const seen = new Set<number>()
  const counts: CountEntry[] = raw.counts.map((entry) => {
    if (typeof entry !== 'object' || entry === null) fail('each count must be an object')
    const { id, amount } = entry as Record<string, unknown>

    if (typeof id !== 'number' || !Number.isInteger(id)) fail('count id must be an integer')
    if (!validIds.has(id)) fail(`unknown product id ${id}`)
    if (seen.has(id)) fail(`duplicate product id ${id}`)
    seen.add(id)

    if (amount === null) return { id, amount: null }
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      fail(`amount for ${id} must be an integer or null`)
    }
    if (amount < 0 || amount > MAX_AMOUNT) fail(`amount for ${id} out of range`)

    return { id, amount }
  })

  return { counter_name, counts }
}
