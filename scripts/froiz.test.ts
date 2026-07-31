import { describe, expect, it } from 'vitest'
import { froizImageUrl, froizProductUrl, type FroizProduct } from './froiz'

const sample: FroizProduct = {
  id: 21716,
  name: 'Almohadilla limpieza Froiz superficies delicadas 2 u',
  slug: '21716-almohadilla-limpieza-froiz-superficies-delicadas-2-u',
  image: '/laxGYDNZyT04iZVpzPzryw/69e1d84f/desktop?exp=1785528182&sig=abc',
  measurement_unit: 'Unidad',
  per_unit: false,
  fractional: false,
}

describe('froizProductUrl', () => {
  it('construye la url de tienda desde el slug', () => {
    expect(froizProductUrl(sample)).toBe(
      'https://supermercado.froiz.com/product/21716-almohadilla-limpieza-froiz-superficies-delicadas-2-u',
    )
  })
})

describe('froizImageUrl', () => {
  it('usa la ruta firmada que devuelve la api, sin hardcodear el hash de cuenta', () => {
    expect(froizImageUrl(sample)).toBe(
      'https://imagedelivery.net/laxGYDNZyT04iZVpzPzryw/69e1d84f/desktop?exp=1785528182&sig=abc',
    )
  })
})
