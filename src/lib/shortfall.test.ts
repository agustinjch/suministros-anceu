import { describe, expect, it } from 'vitest'
import { buildReport } from './shortfall'
import type { Product } from './types'

function product(id: number, target: number, name = `p${id}`): Product {
  return {
    id,
    name,
    name_en: name,
    froiz_name: name,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target,
    unit: 'ud',
    location: 'cocina',
  }
}

describe('buildReport', () => {
  it('calcula lo que falta cuando hay menos del objetivo', () => {
    const report = buildReport([product(1, 7)], [{ id: 1, amount: 4 }])
    expect(report.toBuy).toHaveLength(1)
    expect(report.toBuy[0].buy).toBe(3)
    expect(report.toBuy[0].have).toBe(4)
  })

  it('no genera linea de compra cuando hay justo el objetivo', () => {
    const report = buildReport([product(1, 3)], [{ id: 1, amount: 3 }])
    expect(report.toBuy).toHaveLength(0)
    expect(report.counted).toHaveLength(1)
    expect(report.counted[0].buy).toBe(0)
  })

  it('hace clamp a 0 con exceso de stock en vez de dar negativo', () => {
    // Estrella Galicia en el sheet real: objetivo 6, hay 12.
    const report = buildReport([product(1, 6)], [{ id: 1, amount: 12 }])
    expect(report.toBuy).toHaveLength(0)
    expect(report.counted[0].buy).toBe(0)
  })

  it('un producto no contado no cuenta como cero ni genera compra', () => {
    const report = buildReport([product(1, 5)], [{ id: 1, amount: null }])
    expect(report.toBuy).toHaveLength(0)
    expect(report.counted).toHaveLength(0)
    expect(report.notCounted).toEqual([product(1, 5)])
  })

  it('un producto ausente de los conteos se trata como no contado', () => {
    const report = buildReport([product(1, 5)], [])
    expect(report.notCounted).toHaveLength(1)
    expect(report.counted).toHaveLength(0)
  })

  it('counted y notCounted suman el catalogo y no se solapan', () => {
    const products = [product(1, 3), product(2, 3), product(3, 3)]
    const report = buildReport(products, [
      { id: 1, amount: 0 },
      { id: 2, amount: null },
    ])
    expect(report.counted).toHaveLength(1)
    expect(report.notCounted).toHaveLength(2)
    expect(report.counted.length + report.notCounted.length).toBe(products.length)
  })

  it('contado a cero si genera compra por el objetivo entero', () => {
    const report = buildReport([product(1, 3)], [{ id: 1, amount: 0 }])
    expect(report.toBuy[0].buy).toBe(3)
  })

  it('mantiene el orden del catalogo', () => {
    const products = [product(10, 1), product(20, 1), product(30, 1)]
    const report = buildReport(products, [
      { id: 30, amount: 0 },
      { id: 10, amount: 0 },
      { id: 20, amount: 0 },
    ])
    expect(report.toBuy.map((l) => l.product.id)).toEqual([10, 20, 30])
  })

  it('ignora conteos de ids que no estan en el catalogo', () => {
    const report = buildReport([product(1, 3)], [
      { id: 1, amount: 1 },
      { id: 999, amount: 1 },
    ])
    expect(report.counted).toHaveLength(1)
    expect(report.toBuy).toHaveLength(1)
  })
})
