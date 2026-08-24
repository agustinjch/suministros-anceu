// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Start } from './Start'

afterEach(cleanup)

describe('Start', () => {
  it('can return to the task home before starting Supplies', () => {
    const onHome = vi.fn()
    render(
      <Start lang="es" total={47} counterName="" hasSaved={false}
        onNameChange={vi.fn()} onStart={vi.fn()} onResume={vi.fn()}
        onStartOver={vi.fn()} onHome={onHome} />,
    )
    screen.getByRole('button', { name: /Volver al inicio/ }).click()
    expect(onHome).toHaveBeenCalledOnce()
  })
})
