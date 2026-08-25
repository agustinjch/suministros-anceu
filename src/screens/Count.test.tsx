// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../lib/types'
import { Count } from './Count'

afterEach(cleanup)

function product(id: number, name: string, location: Product['location'] = 'cocina'): Product {
  return {
    id,
    name,
    name_en: name,
    froiz_name: `Froiz ${name}`,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target: 4,
    unit: 'ud',
    location,
  }
}

const products = [
  product(1, 'Papel de cocina'),
  product(2, 'Bayetas'),
  product(3, 'Vinagre de limpieza', 'armario_limpieza' as Product['location']),
]

const noop = () => {}

interface Overrides {
  index?: number
  amounts?: Record<number, number | null>
  onSet?: (id: number, amount: number | null) => void
  onSkip?: (id: number) => void
  onBack?: () => void
  onNext?: () => void
  onLangChange?: (lang: 'es' | 'en') => void
}

function renderCount(overrides: Overrides = {}) {
  const {
    index = 0,
    amounts = {},
    onSet = noop,
    onSkip = noop,
    onBack = noop,
    onNext = noop,
    onLangChange = noop,
  } = overrides
  return render(
    <Count
      lang="es"
      onLangChange={onLangChange}
      products={products}
      index={index}
      amounts={amounts}
      onSet={onSet}
      onSkip={onSkip}
      onBack={onBack}
      onNext={onNext}
    />,
  )
}

function input(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('input')
  if (!el) throw new Error('no hay input en la card')
  return el
}

describe('Count', () => {
  it('muestra el progreso y la zona del producto actual', () => {
    renderCount({ index: 2 })
    expect(screen.getByText(/3 de 3/)).toBeDefined()
    expect(screen.getByText('Armario limpieza')).toBeDefined()
  })

  it('Atras esta deshabilitado en el primer producto', () => {
    renderCount({ index: 0 })
    expect(screen.getByRole('button', { name: 'Atrás' })).toHaveProperty('disabled', true)
  })

  it('el ultimo producto lleva a Revisar en vez de a Siguiente', () => {
    renderCount({ index: 2, amounts: { 3: 1 } })
    expect(screen.getByRole('button', { name: 'Revisar' })).toBeDefined()
  })

  describe('Siguiente y la tecla del teclado van juntos', () => {
    it('Siguiente esta deshabilitado sin numero', () => {
      renderCount({ index: 0, amounts: {} })
      expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveProperty('disabled', true)
    })

    it('la tecla tampoco avanza sin numero, igual que el boton', () => {
      const onNext = vi.fn()
      const { container } = renderCount({ index: 0, amounts: {}, onNext })

      fireEvent.keyDown(input(container), { key: 'Enter' })
      expect(onNext).not.toHaveBeenCalled()
    })

    it('con un numero, la tecla avanza', () => {
      const onNext = vi.fn()
      const { container } = renderCount({ index: 0, amounts: { 1: 2 }, onNext })

      fireEvent.keyDown(input(container), { key: 'Enter' })
      expect(onNext).toHaveBeenCalledOnce()
    })

    it('un cero cuenta como respuesta: la tecla avanza', () => {
      const onNext = vi.fn()
      const { container } = renderCount({ index: 0, amounts: { 1: 0 }, onNext })

      fireEvent.keyDown(input(container), { key: 'Enter' })
      expect(onNext).toHaveBeenCalledOnce()
    })

    it('un producto saltado no cuenta como respuesta: la tecla no avanza', () => {
      const onNext = vi.fn()
      const { container } = renderCount({ index: 0, amounts: { 1: null }, onNext })

      fireEvent.keyDown(input(container), { key: 'Enter' })
      expect(onNext).not.toHaveBeenCalled()
    })
  })

  it('la tecla se etiqueta done en el ultimo producto y next en los demas', () => {
    const { container } = renderCount({ index: 0, amounts: { 1: 1 } })
    expect(input(container).getAttribute('enterkeyhint')).toBe('next')
    cleanup()

    const last = renderCount({ index: 2, amounts: { 3: 1 } })
    expect(input(last.container).getAttribute('enterkeyhint')).toBe('done')
  })

  describe('idioma en el topbar', () => {
    it('el toggle va en la misma fila que la zona y el progreso', () => {
      const { container } = renderCount({ index: 0 })
      const topbar = container.querySelector('.topbar')

      // Las tres cosas en una sola fila: es lo que ahorra el alto que falta con
      // el teclado abierto.
      expect(topbar?.querySelector('.zone')?.textContent).toBe('Cocina')
      expect(topbar?.querySelector('.progress')?.textContent).toContain('1 de 3')
      expect(topbar?.querySelector('.lang')).not.toBeNull()
    })

    it('cambiar de idioma avisa al padre', () => {
      const onLangChange = vi.fn()
      renderCount({ index: 0, onLangChange })

      screen.getByRole('button', { name: 'EN' }).click()
      expect(onLangChange).toHaveBeenCalledWith('en')
    })
  })

  describe('los botones no cierran el teclado del movil', () => {
    it('los tres botones impiden el cambio de foco en mousedown', () => {
      renderCount({ index: 1, amounts: { 2: 1 } })

      for (const name of ['Atrás', 'Saltar', 'Siguiente']) {
        const button = screen.getByRole('button', { name })
        // fireEvent.mouseDown devuelve false si algun handler llamo a
        // preventDefault, que es exactamente lo que evita que el boton robe el
        // foco al input y cierre el teclado.
        expect(fireEvent.mouseDown(button), name).toBe(false)
      }
    })

    it('aun asi el click funciona: preventDefault en mousedown no lo cancela', () => {
      const onNext = vi.fn()
      renderCount({ index: 0, amounts: { 1: 3 }, onNext })
      const next = screen.getByRole('button', { name: 'Siguiente' })

      fireEvent.mouseDown(next)
      fireEvent.click(next)
      expect(onNext).toHaveBeenCalledOnce()
    })
  })

  it('Saltar marca el producto como no contado y avanza', () => {
    const onSkip = vi.fn()
    const onNext = vi.fn()
    renderCount({ index: 1, onSkip, onNext })

    screen.getByRole('button', { name: 'Saltar' }).click()
    expect(onSkip).toHaveBeenCalledWith(2)
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('Saltar funciona aunque no haya numero, al contrario que Siguiente', () => {
    const onSkip = vi.fn()
    renderCount({ index: 0, amounts: {}, onSkip })

    expect(screen.getByRole('button', { name: 'Saltar' })).toHaveProperty('disabled', false)
    screen.getByRole('button', { name: 'Saltar' }).click()
    expect(onSkip).toHaveBeenCalledWith(1)
  })
})
