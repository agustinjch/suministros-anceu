// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WhiteboardDraft } from '../lib/whiteboard-drafts'
import { Whiteboard, type WhiteboardDependencies } from './Whiteboard'

afterEach(cleanup)

function dependencies(restored: WhiteboardDraft | null = null) {
  const deps: WhiteboardDependencies = {
    prepare: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
    load: vi.fn(async () => restored),
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    send: vi.fn(async () => new Response(null, { status: 200 })),
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  }
  return deps
}

function renderTask(deps = dependencies()) {
  const onSent = vi.fn()
  render(<Whiteboard board="beverages" lang="es" onHome={vi.fn()} onSent={onSent} deps={deps} />)
  return { deps, onSent }
}

describe('Whiteboard', () => {
  it('shows a top action to return home before doing the task', async () => {
    renderTask()
    expect(await screen.findByRole('button', { name: /Volver al inicio/ })).toBeDefined()
  })

  it('requires a name, photo, and erasure confirmation before sending', async () => {
    renderTask()
    const send = await screen.findByRole('button', { name: /Enviar/ })
    expect(send).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Marta' } })
    const photo = new File(['raw'], 'board.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Elegir de la galería'), { target: { files: [photo] } })

    expect(await screen.findByAltText(/pizarra de bebidas/i)).toBeDefined()
    expect(screen.getByText(/borra ahora/i)).toBeDefined()
    expect(send).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('checkbox', { name: /he borrado/i }))
    await waitFor(() => expect(send).toHaveProperty('disabled', false))
  })

  it('restores a saved board draft', async () => {
    const restored: WhiteboardDraft = {
      board: 'beverages', completedBy: 'Brais', erased: true,
      photo: new Blob(['jpeg'], { type: 'image/jpeg' }), updatedAt: 123,
    }
    renderTask(dependencies(restored))
    expect(await screen.findByDisplayValue('Brais')).toBeDefined()
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', true)
    expect(screen.getByRole('button', { name: /Enviar/ })).toHaveProperty('disabled', false)
  })

  it('keeps the draft on failure and clears it only after success', async () => {
    const deps = dependencies({
      board: 'beverages', completedBy: 'Marta', erased: true,
      photo: new Blob(['jpeg'], { type: 'image/jpeg' }), updatedAt: 123,
    })
    deps.send = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const { onSent } = renderTask(deps)
    const send = await screen.findByRole('button', { name: /Enviar/ })

    fireEvent.click(send)
    expect(await screen.findByText(/No se pudo enviar/)).toBeDefined()
    expect(deps.clear).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    await waitFor(() => expect(deps.clear).toHaveBeenCalledWith('beverages'))
    expect(onSent).toHaveBeenCalledOnce()

    const request = vi.mocked(deps.send).mock.calls[1][0]
    const form = request.body as FormData
    expect(form.get('board')).toBe('beverages')
    expect(form.get('completed_by')).toBe('Marta')
    expect(form.get('erased')).toBe('true')
  })
})
