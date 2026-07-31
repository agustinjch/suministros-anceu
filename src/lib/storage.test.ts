// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, loadSession, saveSession, sortByZone, toCountEntries } from './storage'
import type { Product, Session } from './types'

beforeEach(() => {
  localStorage.clear()
})

const session: Session = {
  counterName: 'Bartek',
  amounts: { 1: 4, 2: null },
}

function product(id: number, location: Product['location']): Product {
  return {
    id,
    name: `p${id}`,
    name_en: `p${id}`,
    froiz_name: `p${id}`,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target: 1,
    unit: 'ud',
    location,
  }
}

describe('session storage', () => {
  it('guarda y recupera una sesion', () => {
    saveSession(session)
    expect(loadSession()).toEqual(session)
  })

  it('devuelve null si no hay nada guardado', () => {
    expect(loadSession()).toBeNull()
  })

  it('devuelve null y limpia si lo guardado esta corrupto', () => {
    localStorage.setItem('suministros-anceu:session', '{ not json')
    expect(loadSession()).toBeNull()
  })

  it('devuelve null si lo guardado no tiene la forma esperada', () => {
    localStorage.setItem('suministros-anceu:session', '{"counterName":"x"}')
    expect(loadSession()).toBeNull()
  })

  it('clearSession borra', () => {
    saveSession(session)
    clearSession()
    expect(loadSession()).toBeNull()
  })

  it('no propaga el fallo de localStorage lleno', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveSession(session)).not.toThrow()
  })
})

describe('toCountEntries', () => {
  it('convierte el mapa en el array que espera la api', () => {
    expect(toCountEntries(session)).toEqual([
      { id: 1, amount: 4 },
      { id: 2, amount: null },
    ])
  })
})

describe('sortByZone', () => {
  it('ordena por el recorrido de la casa, no por el orden de entrada', () => {
    const sorted = sortByZone([
      product(1, 'cafeteria'),
      product(2, 'cocina'),
      product(3, 'bebidas'),
    ])
    expect(sorted.map((p) => p.location)).toEqual(['cocina', 'bebidas', 'cafeteria'])
  })

  it('mantiene el orden original dentro de cada zona', () => {
    const sorted = sortByZone([product(9, 'cocina'), product(4, 'cocina')])
    expect(sorted.map((p) => p.id)).toEqual([9, 4])
  })
})
