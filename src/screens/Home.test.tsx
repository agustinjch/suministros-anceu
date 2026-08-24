// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Home } from './Home'

afterEach(cleanup)

describe('Home', () => {
  it('offers the three independent tasks', () => {
    const onSupplies = vi.fn()
    const onWhiteboard = vi.fn()
    render(<Home lang="es" onSupplies={onSupplies} onWhiteboard={onWhiteboard} />)

    screen.getByRole('button', { name: /Suministros/ }).click()
    screen.getByRole('button', { name: /Pizarra de bebidas/ }).click()
    screen.getByRole('button', { name: /Pizarra de lavandería/ }).click()

    expect(onSupplies).toHaveBeenCalledOnce()
    expect(onWhiteboard).toHaveBeenNthCalledWith(1, 'beverages')
    expect(onWhiteboard).toHaveBeenNthCalledWith(2, 'laundry')
  })
})
