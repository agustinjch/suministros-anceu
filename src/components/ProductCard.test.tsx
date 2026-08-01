// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Product } from '../lib/types'
import { ProductCard } from './ProductCard'

afterEach(cleanup)

const shandy: Product = {
  id: 7292,
  name: 'Shandy (pack de 6)',
  name_en: 'Shandy, lemon (6-pack)',
  froiz_name: 'Cerveza Cruzcampo Shandy limón pack 6x25 cl',
  froiz_url: 'https://supermercado.froiz.com/product/7292-x',
  image: '/img/7292.jpg',
  target: 5,
  unit: 'pack',
  location: 'bebidas',
}

/**
 * Sin ningún dígito en los nombres, para que buscar el objetivo en el texto
 * renderizado sea concluyente. Con Shandy no lo seria: su nombre de Froiz lleva
 * "6x25 cl", y un `not.toContain('5')` saltaria por el 25.
 */
const lejia: Product = {
  id: 4976,
  name: 'Lejía con detergente',
  name_en: 'Bleach with detergent',
  froiz_name: 'Lejía Froiz con detergente',
  froiz_url: 'https://supermercado.froiz.com/product/4976-x',
  image: '/img/4976.jpg',
  target: 5,
  unit: 'ud',
  location: 'limpieza',
}

const noop = () => {}

describe('ProductCard', () => {
  it('no muestra cuanto deberia haber', () => {
    for (const lang of ['es', 'en'] as const) {
      const { container } = render(
        <ProductCard product={lejia} lang={lang} value={undefined} onChange={noop} />,
      )
      // El objetivo es 5 y no hay ningun otro digito en la card.
      expect(container.textContent, lang).not.toContain('5')
      expect(container.textContent, lang).not.toMatch(/deber[ií]a/i)
      expect(container.textContent, lang).not.toMatch(/should be/i)
      cleanup()
    }
  })

  it('tampoco lo muestra con un valor ya metido', () => {
    const { container } = render(
      <ProductCard product={lejia} lang="es" value={2} onChange={noop} />,
    )
    expect(container.textContent).not.toContain('5')
  })

  it('si muestra la unidad, que hace falta para saber que se cuenta', () => {
    render(<ProductCard product={shandy} lang="es" value={undefined} onChange={noop} />)
    expect(screen.getByText('packs')).toBeDefined()
  })

  it('muestra el nombre y el nombre canonico de Froiz', () => {
    render(<ProductCard product={shandy} lang="es" value={undefined} onChange={noop} />)
    expect(screen.getByText('Shandy (pack de 6)')).toBeDefined()
    expect(screen.getByText('Cerveza Cruzcampo Shandy limón pack 6x25 cl')).toBeDefined()
  })

  it('traduce el nombre y la unidad al ingles', () => {
    render(<ProductCard product={shandy} lang="en" value={undefined} onChange={noop} />)
    expect(screen.getByText('Shandy, lemon (6-pack)')).toBeDefined()
    expect(screen.getByText('packs')).toBeDefined()
  })

  it('el input sale vacio cuando el producto esta saltado o sin tocar', () => {
    const { container } = render(
      <ProductCard product={shandy} lang="es" value={null} onChange={noop} />,
    )
    const input = container.querySelector('input')
    expect(input?.value).toBe('')
  })

  it('el input saca teclado numerico en el movil', () => {
    const { container } = render(
      <ProductCard product={shandy} lang="es" value={2} onChange={noop} />,
    )
    const input = container.querySelector('input')
    expect(input?.getAttribute('inputmode')).toBe('numeric')
    expect(input?.value).toBe('2')
  })
})
