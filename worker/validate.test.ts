import { describe, expect, it } from 'vitest'
import { ValidationError, parseSendRequest } from './validate'

const ids = new Set([1, 2, 3])

describe('parseSendRequest', () => {
  it('acepta un cuerpo valido', () => {
    const parsed = parseSendRequest(
      { counter_name: 'Bartek', counts: [{ id: 1, amount: 4 }, { id: 2, amount: null }] },
      ids,
    )
    expect(parsed.counter_name).toBe('Bartek')
    expect(parsed.counts).toHaveLength(2)
  })

  it('acepta counter_name ausente y lo deja vacio', () => {
    const parsed = parseSendRequest({ counts: [{ id: 1, amount: 0 }] }, ids)
    expect(parsed.counter_name).toBe('')
  })

  it('rechaza un cuerpo que no es objeto', () => {
    expect(() => parseSendRequest('nope', ids)).toThrow(ValidationError)
    expect(() => parseSendRequest(null, ids)).toThrow(ValidationError)
  })

  it('rechaza counts que no es array', () => {
    expect(() => parseSendRequest({ counts: 'x' }, ids)).toThrow(ValidationError)
  })

  it('rechaza counts vacio', () => {
    expect(() => parseSendRequest({ counts: [] }, ids)).toThrow(ValidationError)
  })

  it('rechaza ids que no estan en el catalogo', () => {
    expect(() => parseSendRequest({ counts: [{ id: 999, amount: 1 }] }, ids)).toThrow(
      /unknown product/i,
    )
  })

  it('rechaza ids repetidos', () => {
    expect(() =>
      parseSendRequest({ counts: [{ id: 1, amount: 1 }, { id: 1, amount: 2 }] }, ids),
    ).toThrow(/duplicate/i)
  })

  it('rechaza cantidades negativas', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: -1 }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza cantidades no enteras', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: 1.5 }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza cantidades absurdas', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: 100_000 }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza cantidades que no son numero ni null', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: '4' }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza mas counts que productos del catalogo', () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ id: 1, amount: i }))
    expect(() => parseSendRequest({ counts: many }, ids)).toThrow(ValidationError)
  })

  it('recorta y limita la longitud del nombre', () => {
    const parsed = parseSendRequest(
      { counter_name: `  ${'a'.repeat(500)}  `, counts: [{ id: 1, amount: 1 }] },
      ids,
    )
    expect(parsed.counter_name.length).toBe(80)
  })

  it('rechaza counter_name que no es string', () => {
    expect(() => parseSendRequest({ counter_name: 5, counts: [{ id: 1, amount: 1 }] }, ids)).toThrow(
      ValidationError,
    )
  })
})
