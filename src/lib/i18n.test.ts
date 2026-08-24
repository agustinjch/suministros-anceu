import { describe, expect, it } from 'vitest'
import { DEFAULT_LANG, productName, t, unitLabel } from './i18n'
import type { Product } from './types'

const p: Product = {
  id: 1,
  name: 'Papel de cocina',
  name_en: 'Kitchen paper',
  froiz_name: 'Papel cocina Froiz maxi',
  froiz_url: 'https://supermercado.froiz.com/product/1-x',
  image: '/img/1.jpg',
  target: 7,
  unit: 'ud',
  location: 'cocina',
}

describe('i18n', () => {
  it('el idioma por defecto es español', () => {
    expect(DEFAULT_LANG).toBe('es')
  })

  it('devuelve el nombre en el idioma pedido', () => {
    expect(productName(p, 'es')).toBe('Papel de cocina')
    expect(productName(p, 'en')).toBe('Kitchen paper')
  })

  it('cae al español si falta la traducción', () => {
    expect(productName({ ...p, name_en: '' }, 'en')).toBe('Papel de cocina')
  })

  it('traduce las unidades', () => {
    expect(unitLabel('pack', 'es')).toBe('packs')
    expect(unitLabel('pack', 'en')).toBe('packs')
    expect(unitLabel('bolsa', 'es')).toBe('bolsas')
    expect(unitLabel('bolsa', 'en')).toBe('bags')
  })

  it('define las mismas claves en los dos idiomas', () => {
    expect(Object.keys(t('es')).sort()).toEqual(Object.keys(t('en')).sort())
  })

  it('no deja ningun texto vacio', () => {
    for (const lang of ['es', 'en'] as const) {
      for (const [key, value] of Object.entries(t(lang))) {
        expect(value, `${lang}.${key}`).toBeTruthy()
      }
    }
  })

  it('traduce la portada y las instrucciones de las pizarras', () => {
    expect(t('es').taskBeverages).toBe('Pizarra de bebidas')
    expect(t('en').taskLaundry).toBe('Laundry whiteboard')
    expect(t('es').eraseConfirmation).toContain('borrado')
    expect(t('en').chooseGallery).toContain('gallery')
  })
})
