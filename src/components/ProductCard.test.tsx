// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

interface Overrides {
  product?: Product
  lang?: 'es' | 'en'
  value?: number | null
  onChange?: (amount: number | null) => void
  onEnter?: () => void
  enterKeyHint?: 'next' | 'done'
}

/** Render con props por defecto: cada test solo declara lo que le importa. */
function renderCard(overrides: Overrides = {}) {
  const {
    product = shandy,
    lang = 'es',
    value = undefined,
    onChange = noop,
    onEnter = noop,
    enterKeyHint = 'next',
  } = overrides
  return render(
    <ProductCard
      product={product}
      lang={lang}
      value={value}
      onChange={onChange}
      onEnter={onEnter}
      enterKeyHint={enterKeyHint}
    />,
  )
}

describe('ProductCard', () => {
  it('no muestra cuanto deberia haber', () => {
    for (const lang of ['es', 'en'] as const) {
      const { container } = renderCard({ product: lejia, lang: lang, value: undefined })
      // El objetivo es 5 y no hay ningun otro digito en la card.
      expect(container.textContent, lang).not.toContain('5')
      expect(container.textContent, lang).not.toMatch(/deber[ií]a/i)
      expect(container.textContent, lang).not.toMatch(/should be/i)
      cleanup()
    }
  })

  it('tampoco lo muestra con un valor ya metido', () => {
    const { container } = renderCard({ product: lejia, lang: 'es', value: 2 })
    expect(container.textContent).not.toContain('5')
  })

  it('si muestra la unidad, que hace falta para saber que se cuenta', () => {
    renderCard({ product: shandy, lang: 'es', value: undefined })
    expect(screen.getByText('packs')).toBeDefined()
  })

  it('muestra el nombre del producto', () => {
    const { container } = renderCard({ product: shandy, lang: 'es', value: undefined })
    // El titulo lleva la (i) dentro, asi que se busca en el h2 y no por texto exacto.
    expect(container.querySelector('h2')?.textContent).toContain('Shandy (pack de 6)')
  })

  it('traduce el nombre y la unidad al ingles', () => {
    const { container } = renderCard({ product: shandy, lang: 'en', value: undefined })
    expect(container.querySelector('h2')?.textContent).toContain('Shandy, lemon (6-pack)')
    expect(screen.getByText('packs')).toBeDefined()
  })

  it('el input sale vacio cuando el producto esta saltado o sin tocar', () => {
    const { container } = renderCard({ product: shandy, lang: 'es', value: null })
    const input = container.querySelector('input')
    expect(input?.value).toBe('')
  })

  it('el input saca teclado numerico en el movil', () => {
    const { container } = renderCard({ product: shandy, lang: 'es', value: 2 })
    const input = container.querySelector('input')
    expect(input?.getAttribute('inputmode')).toBe('numeric')
    expect(input?.value).toBe('2')
  })

  describe('descripcion plegable', () => {
    it('la descripcion no sale por defecto: con titulo y foto suele bastar', () => {
      renderCard({ product: shandy })
      expect(screen.queryByText('Cerveza Cruzcampo Shandy limón pack 6x25 cl')).toBeNull()
    })

    it('la (i) la despliega y la vuelve a plegar', () => {
      renderCard({ product: shandy })
      const info = screen.getByRole('button', { name: 'Ver descripción' })

      fireEvent.click(info)
      expect(screen.getByText('Cerveza Cruzcampo Shandy limón pack 6x25 cl')).toBeDefined()
      expect(info.getAttribute('aria-expanded')).toBe('true')

      fireEvent.click(info)
      expect(screen.queryByText('Cerveza Cruzcampo Shandy limón pack 6x25 cl')).toBeNull()
      expect(info.getAttribute('aria-expanded')).toBe('false')
    })

    it('vuelve a plegarse al cambiar de producto', () => {
      const { rerender } = render(
        <ProductCard
          product={shandy}
          lang="es"
          value={1}
          onChange={noop}
          onEnter={noop}
          enterKeyHint="next"
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Ver descripción' }))
      expect(screen.getByText('Cerveza Cruzcampo Shandy limón pack 6x25 cl')).toBeDefined()

      rerender(
        <ProductCard
          product={lejia}
          lang="es"
          value={undefined}
          onChange={noop}
          onEnter={noop}
          enterKeyHint="next"
        />,
      )
      expect(screen.queryByText('Lejía Froiz con detergente')).toBeNull()
    })

    it('la (i) tampoco roba el foco al input', () => {
      renderCard({ product: shandy })
      const info = screen.getByRole('button', { name: 'Ver descripción' })
      expect(fireEvent.mouseDown(info)).toBe(false)
    })
  })

  describe('foco', () => {
    it('el input arranca enfocado', () => {
      const { container } = renderCard()
      expect(document.activeElement).toBe(container.querySelector('input'))
    })

    it('recupera el foco al cambiar de producto, aunque React reutilice el input', () => {
      const { container, rerender } = render(
        <ProductCard
          product={shandy}
          lang="es"
          value={2}
          onChange={noop}
          onEnter={noop}
          enterKeyHint="next"
        />,
      )
      const first = container.querySelector('input')

      // Simula lo que hace pulsar "Siguiente": el foco se va del input.
      first?.blur()
      expect(document.activeElement).not.toBe(first)

      rerender(
        <ProductCard
          product={lejia}
          lang="es"
          value={undefined}
          onChange={noop}
          onEnter={noop}
          enterKeyHint="next"
        />,
      )

      // Mismo nodo reutilizado por React, pero enfocado de nuevo.
      const second = container.querySelector('input')
      expect(second).toBe(first)
      expect(document.activeElement).toBe(second)
    })

    it('no se re-enfoca al teclear en el mismo producto', () => {
      const { container, rerender } = render(
        <ProductCard
          product={shandy}
          lang="es"
          value={1}
          onChange={noop}
          onEnter={noop}
          enterKeyHint="next"
        />,
      )
      container.querySelector('input')?.blur()

      // Mismo producto, otro valor: el efecto depende de product.id, asi que no
      // debe robar el foco mientras el usuario escribe.
      rerender(
        <ProductCard
          product={shandy}
          lang="es"
          value={12}
          onChange={noop}
          onEnter={noop}
          enterKeyHint="next"
        />,
      )
      expect(document.activeElement).not.toBe(container.querySelector('input'))
    })
  })

  describe('tecla de accion del teclado', () => {
    it('la etiqueta de la tecla es "next" o "done" segun se le pase', () => {
      const { container } = renderCard({ enterKeyHint: 'next' })
      expect(container.querySelector('input')?.getAttribute('enterkeyhint')).toBe('next')
      cleanup()

      const last = renderCard({ enterKeyHint: 'done' })
      expect(last.container.querySelector('input')?.getAttribute('enterkeyhint')).toBe('done')
    })

    it('Enter avisa al padre, que es lo que permite avanzar sin salir del teclado', () => {
      const onEnter = vi.fn()
      const { container } = renderCard({ value: 3, onEnter })

      fireEvent.keyDown(container.querySelector('input')!, { key: 'Enter' })
      expect(onEnter).toHaveBeenCalledOnce()
    })

    it('otras teclas no avisan', () => {
      const onEnter = vi.fn()
      const { container } = renderCard({ value: 3, onEnter })
      const input = container.querySelector('input')!

      for (const key of ['a', 'Tab', 'Escape', 'ArrowDown', '5']) {
        fireEvent.keyDown(input, { key })
      }
      expect(onEnter).not.toHaveBeenCalled()
    })
  })
})
