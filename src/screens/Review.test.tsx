// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../lib/types'
import { Review } from './Review'

// Sin `globals: true` en la config, Testing Library no registra su limpieza
// automática: sin esto, el segundo `render` deja dos copias en el documento y
// `getByText` falla por encontrar varias coincidencias.
afterEach(cleanup)

function product(id: number, name: string, target: number): Product {
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

const products = [product(1, 'Papel de cocina', 7), product(2, 'Estropajos', 4)]
const noop = () => {}

describe('Review', () => {
  it('muestra lo contado y marca lo saltado como sin contar', () => {
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: null }}
        counterName="Bartek"
        status="idle"
        onEdit={noop}
        onSend={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByText('Papel de cocina')).toBeDefined()
    expect(screen.getByText('sin contar')).toBeDefined()
  })

  it('deshabilita enviar mientras esta enviando', () => {
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: 4 }}
        counterName="Bartek"
        status="sending"
        onEdit={noop}
        onSend={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Enviando…' })).toHaveProperty('disabled', true)
  })

  it('muestra el error y ofrece reintentar sin perder los datos', () => {
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: 4 }}
        counterName="Bartek"
        status="error"
        onEdit={noop}
        onSend={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByText(/No se pudo enviar/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined()
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
  })

  it('llama a onEdit con el indice del producto pulsado', () => {
    const onEdit = vi.fn()
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: 4 }}
        counterName="Bartek"
        status="idle"
        onEdit={onEdit}
        onSend={noop}
        onBack={noop}
      />,
    )
    screen.getAllByRole('button', { name: 'Cambiar' })[1].click()
    expect(onEdit).toHaveBeenCalledWith(1)
  })

  it('marca en rojo solo las filas por debajo del objetivo', () => {
    const { container } = render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: 4 }}
        counterName=""
        status="idle"
        onEdit={noop}
        onSend={noop}
        onBack={noop}
      />,
    )
    // Papel de cocina: 4 de 7 -> corto. Estropajos: 4 de 4 -> no.
    expect(container.querySelectorAll('tr.short')).toHaveLength(1)
  })
})
