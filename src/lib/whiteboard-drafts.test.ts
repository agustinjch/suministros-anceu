// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearWhiteboardDraft,
  loadWhiteboardDraft,
  saveWhiteboardDraft,
  type WhiteboardDraft,
} from './whiteboard-drafts'

function draft(board: WhiteboardDraft['board'], name: string): WhiteboardDraft {
  return {
    board,
    completedBy: name,
    erased: false,
    photo: new NodeBlob(['jpeg'], { type: 'image/jpeg' }) as unknown as Blob,
    updatedAt: 123,
  }
}

beforeEach(async () => {
  await Promise.all([clearWhiteboardDraft('beverages'), clearWhiteboardDraft('laundry')])
})

describe('whiteboard drafts', () => {
  it('stores and restores a JPEG draft', async () => {
    await saveWhiteboardDraft(draft('beverages', 'Marta'))
    const loaded = await loadWhiteboardDraft('beverages')
    expect(loaded).toMatchObject({ board: 'beverages', completedBy: 'Marta', erased: false })
    expect(loaded?.photo).toMatchObject({ type: 'image/jpeg', size: 4 })
  })

  it('keeps both board drafts independent', async () => {
    await saveWhiteboardDraft(draft('beverages', 'Marta'))
    await saveWhiteboardDraft({ ...draft('laundry', 'Brais'), erased: true })
    await clearWhiteboardDraft('beverages')
    expect(await loadWhiteboardDraft('beverages')).toBeNull()
    expect(await loadWhiteboardDraft('laundry')).toMatchObject({ completedBy: 'Brais', erased: true })
  })

  it('replaces only the selected board', async () => {
    await saveWhiteboardDraft(draft('beverages', 'First'))
    await saveWhiteboardDraft(draft('laundry', 'Other'))
    await saveWhiteboardDraft(draft('beverages', 'Replacement'))
    expect((await loadWhiteboardDraft('beverages'))?.completedBy).toBe('Replacement')
    expect((await loadWhiteboardDraft('laundry'))?.completedBy).toBe('Other')
  })
})
