import { describe, expect, it } from 'vitest'
import { productIdFromUrl, seedLine } from './add-product'

describe('productIdFromUrl', () => {
  it('extrae el id de una url de tienda', () => {
    expect(
      productIdFromUrl(
        'https://supermercado.froiz.com/product/15592-leche-froiz-sin-lactosa-semidesnatada-1l',
      ),
    ).toBe(15592)
  })

  it('tolera el # que arrastran algunas urls copiadas', () => {
    expect(
      productIdFromUrl('https://supermercado.froiz.com/product/1827-manzanilla-froiz-25-bolsitas#'),
    ).toBe(1827)
  })

  it('falla con una url que no es de producto', () => {
    expect(() => productIdFromUrl('https://supermercado.froiz.com/')).toThrow(/url/i)
  })
})

describe('seedLine', () => {
  it('separa por tabuladores', () => {
    expect(seedLine(15592, 'cafeteria', 12, 'ud', 'Leche sin lactosa', 'Lactose-free milk')).toBe(
      '15592\tcafeteria\t12\tud\tLeche sin lactosa\tLactose-free milk',
    )
  })

  it('rechaza nombres con tabulador, que romperian el tsv', () => {
    expect(() => seedLine(1, 'cocina', 1, 'ud', 'a\tb', 'c')).toThrow(/tab/i)
  })
})
