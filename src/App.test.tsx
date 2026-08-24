// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('App task routing', () => {
  it('starts on the three-task home and opens Supplies', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Tareas semanales' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Suministros' }))
    expect(screen.getByText(/Recorre la casa/)).toBeDefined()
  })

  it('opens each independent whiteboard task', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Pizarra de bebidas' }))
    expect(await screen.findByText('Fotografía la pizarra antes de borrarla.')).toBeDefined()
    cleanup()

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Pizarra de lavandería' }))
    expect(await screen.findByText('Fotografía la pizarra antes de borrarla.')).toBeDefined()
    expect(screen.getByText('Pizarra de lavandería')).toBeDefined()
  })
})
