// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  loadRememberedName,
  loadSession,
  saveRememberedName,
  saveSession,
  sortByZone,
  toCountEntries,
} from './storage'
import type { Product, Session } from './types'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
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

describe('remembered person', () => {
  it('trims and restores a non-empty name', () => {
    saveRememberedName('  Marta  ')
    expect(loadRememberedName()).toBe('Marta')
  })

  it('keeps the remembered name when the supplies session is cleared', () => {
    saveRememberedName('Brais')
    saveSession(session)
    clearSession()
    expect(loadRememberedName()).toBe('Brais')
  })

  it('ignores blank names and caps long names at 80 characters', () => {
    saveRememberedName('Marta')
    saveRememberedName('   ')
    expect(loadRememberedName()).toBe('Marta')
    saveRememberedName('a'.repeat(100))
    expect(loadRememberedName()).toBe('a'.repeat(80))
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
      product(1, 'cocina'),
      product(2, 'cocina'),
      product(3, 'armario_limpieza' as Product['location']),
      product(4, 'congelador' as Product['location']),
      product(5, 'despensa' as Product['location']),
      product(6, 'cafeteria'),
      product(7, 'armario_despensa' as Product['location']),
    ])
    expect(sorted.map((p) => p.location)).toEqual([
      'armario_limpieza',
      'despensa',
      'cafeteria',
      'armario_despensa',
      'congelador',
      'cocina',
      'cocina',
    ])
  })

  it('mantiene el orden original dentro de cada zona', () => {
    const sorted = sortByZone([product(9, 'cocina'), product(4, 'cocina')])
    expect(sorted.map((p) => p.id)).toEqual([9, 4])
  })
})
