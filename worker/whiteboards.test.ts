import { describe, expect, it } from 'vitest'
import {
  WhiteboardValidationError,
  buildWhiteboardEmail,
  bytesToBase64,
  parseWhiteboardForm,
} from './whiteboards'

function jpeg(size = 4): File {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff])
  return new File([bytes], 'board.jpg', { type: 'image/jpeg' })
}

function validForm(): FormData {
  const form = new FormData()
  form.append('board', 'beverages')
  form.append('completed_by', '  Marta  ')
  form.append('erased', 'true')
  form.append('photo', jpeg())
  return form
}

describe('parseWhiteboardForm', () => {
  it('accepts and normalizes one valid JPEG submission', async () => {
    await expect(parseWhiteboardForm(validForm())).resolves.toMatchObject({
      board: 'beverages', completedBy: 'Marta', erased: true,
    })
  })

  it.each([
    ['unknown board', 'board', 'kitchen'],
    ['blank name', 'completed_by', '   '],
    ['missing erasure', 'erased', 'false'],
  ])('rejects %s', async (_label, field, value) => {
    const form = validForm()
    form.set(field, value)
    await expect(parseWhiteboardForm(form)).rejects.toBeInstanceOf(WhiteboardValidationError)
  })

  it('rejects duplicate and unknown fields', async () => {
    const duplicate = validForm()
    duplicate.append('board', 'laundry')
    await expect(parseWhiteboardForm(duplicate)).rejects.toThrow(/exactly once/)
    const unknown = validForm()
    unknown.append('to', 'attacker@example.com')
    await expect(parseWhiteboardForm(unknown)).rejects.toThrow(/unknown field/)
  })

  it('rejects non-JPEG content and a forged JPEG MIME type', async () => {
    const wrongType = validForm()
    wrongType.set('photo', new File(['png'], 'x.png', { type: 'image/png' }))
    await expect(parseWhiteboardForm(wrongType)).rejects.toThrow(/JPEG/)
    const forged = validForm()
    forged.set('photo', new File(['not-jpeg'], 'x.jpg', { type: 'image/jpeg' }))
    await expect(parseWhiteboardForm(forged)).rejects.toThrow(/signature/)
  })

  it('rejects a photo over five megabytes', async () => {
    const form = validForm()
    form.set('photo', jpeg(5_000_001))
    await expect(parseWhiteboardForm(form)).rejects.toThrow(/too large/)
  })
})

describe('whiteboard email', () => {
  it('formats beverages in Madrid time', () => {
    const email = buildWhiteboardEmail(
      { board: 'beverages', completedBy: 'Marta', erased: true, photo: jpeg() },
      new Date('2026-08-24T22:30:00Z'),
    )
    expect(email.subject).toBe('[Anceu] Weekly whiteboard — Beverages — 2026-08-25')
    expect(email.filename).toBe('beverages-whiteboard-2026-08-25.jpg')
    expect(email.text).toContain('Completed by: Marta')
    expect(email.text).toContain('Completed at: 2026-08-25 00:30 Europe/Madrid')
    expect(email.text).toContain('Whiteboard erased: Yes')
  })

  it('formats laundry independently', () => {
    const email = buildWhiteboardEmail(
      { board: 'laundry', completedBy: 'Brais', erased: true, photo: jpeg() },
      new Date('2026-08-24T12:00:00Z'),
    )
    expect(email.subject).toContain('— Laundry —')
    expect(email.filename).toBe('laundry-whiteboard-2026-08-24.jpg')
  })

  it('encodes binary bytes as Base64', () => {
    expect(bytesToBase64(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('/9j/')
  })
})
