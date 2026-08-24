import { describe, expect, it } from 'vitest'
import { WHITEBOARDS } from './whiteboards'

describe('whiteboard configuration', () => {
  it('provides stable email labels and filenames for both boards', () => {
    expect(WHITEBOARDS.beverages).toEqual({
      emailLabel: 'Beverages',
      filename: 'beverages-whiteboard',
    })
    expect(WHITEBOARDS.laundry).toEqual({
      emailLabel: 'Laundry',
      filename: 'laundry-whiteboard',
    })
  })
})
