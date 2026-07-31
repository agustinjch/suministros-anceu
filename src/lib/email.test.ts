import { describe, expect, it } from 'vitest'
import { buildEmail, formatMadrid } from './email'
import type { CountEntry, Product } from './types'

function product(id: number, name: string, target: number): Product {
  return {
    id,
    name,
    name_en: name,
    froiz_name: `Froiz ${name}`,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target,
    unit: 'ud',
    location: 'cocina',
  }
}

const products = [
  product(1, 'Papel de cocina', 7),
  product(2, 'Papel higiénico', 3),
  product(3, 'Estropajos', 4),
]

const counts: CountEntry[] = [
  { id: 1, amount: 4 },
  { id: 2, amount: 3 },
  { id: 3, amount: null },
]

const now = new Date('2026-07-31T16:42:00Z') // 18:42 en Madrid (CEST, UTC+2)

describe('formatMadrid', () => {
  it('convierte a hora de Madrid, no a UTC', () => {
    expect(formatMadrid(now)).toEqual({ date: '2026-07-31', time: '18:42' })
  })

  it('no adelanta el dia con un conteo de madrugada', () => {
    // 23:30 UTC del 30 son las 01:30 del 31 en Madrid.
    expect(formatMadrid(new Date('2026-07-30T23:30:00Z')).date).toBe('2026-07-31')
  })
})

describe('buildEmail', () => {
  it('pone el numero de faltantes y la fecha en el asunto', () => {
    const { subject } = buildEmail(products, counts, 'Bartek', now)
    expect(subject).toBe('[Anceu] Supplies — 1 to buy (2026-07-31)')
  })

  it('cuenta solo los productos que faltan, no los contados', () => {
    // 3 productos: uno corto, uno al objetivo, uno sin contar -> 1 a comprar.
    const { subject } = buildEmail(products, counts, 'Bartek', now)
    expect(subject).toContain('1 to buy')
  })

  it('dice nothing to buy cuando no falta nada', () => {
    const full: CountEntry[] = [
      { id: 1, amount: 7 },
      { id: 2, amount: 3 },
      { id: 3, amount: 4 },
    ]
    const { subject } = buildEmail(products, full, 'Bartek', now)
    expect(subject).toBe('[Anceu] Supplies — nothing to buy (2026-07-31)')
  })

  it('incluye quien ha contado y la hora de Madrid', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    expect(text).toContain('Counted by: Bartek — 2026-07-31 18:42')
  })

  it('sin nombre pone (not given) y no falla', () => {
    const { text } = buildEmail(products, counts, '', now)
    expect(text).toContain('Counted by: (not given)')
  })

  it('recorta los espacios del nombre', () => {
    const { text } = buildEmail(products, counts, '  Bartek  ', now)
    expect(text).toContain('Counted by: Bartek —')
  })

  it('la seccion TO BUY lleva cantidad, unidad y url', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    const line = text.split('\n').find((l) => l.startsWith('Papel de cocina'))!
    expect(line).toContain('have 4')
    expect(line).toContain('should be 7')
    expect(line).toContain('buy 3 ud')
    expect(line).toContain('https://supermercado.froiz.com/product/1-x')
  })

  it('marca OK los productos que estan al objetivo', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    const inventory = text.slice(text.indexOf('FULL INVENTORY'))
    expect(inventory).toMatch(/Papel higiénico.*OK/)
  })

  it('lista los no contados y no los mete en TO BUY ni en FULL INVENTORY', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    const [, rest] = text.split('NOT COUNTED')
    expect(rest).toContain('Estropajos')

    const before = text.slice(0, text.indexOf('NOT COUNTED'))
    expect(before).not.toContain('Estropajos')
  })

  it('las cabeceras de seccion suman el catalogo', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    expect(text).toContain('TO BUY (1)')
    expect(text).toContain('FULL INVENTORY (2 counted)')
    expect(text).toContain('NOT COUNTED (1)')
  })

  it('omite NOT COUNTED cuando se ha contado todo', () => {
    const full: CountEntry[] = [
      { id: 1, amount: 1 },
      { id: 2, amount: 1 },
      { id: 3, amount: 1 },
    ]
    const { text } = buildEmail(products, full, 'Bartek', now)
    expect(text).not.toContain('NOT COUNTED')
  })

  it('dice explicitamente que no falta nada en vez de dejar la seccion vacia', () => {
    const full: CountEntry[] = [
      { id: 1, amount: 7 },
      { id: 2, amount: 3 },
      { id: 3, amount: 4 },
    ]
    const { text } = buildEmail(products, full, 'Bartek', now)
    expect(text).toContain('TO BUY (0)')
    expect(text).toContain('Nothing to buy.')
  })

  it('no deja espacios sobrantes al final de las lineas', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    for (const line of text.split('\n')) {
      expect(line, JSON.stringify(line)).toBe(line.trimEnd())
    }
  })

  it('no lleva html', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    expect(text).not.toMatch(/<[a-z]/i)
  })
})
