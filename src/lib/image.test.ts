// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  ImagePreparationError,
  prepareWhiteboardImage,
  type ImageBrowser,
} from './image'

function browser(width: number, height: number, sizes: number[]): ImageBrowser & {
  dimensions: Array<[number, number]>
  qualities: number[]
} {
  const dimensions: Array<[number, number]> = []
  const qualities: number[] = []
  let attempt = 0
  return {
    dimensions,
    qualities,
    decode: vi.fn().mockResolvedValue({ width, height, source: {}, close: vi.fn() }),
    encode: vi.fn(async (_source, outputWidth, outputHeight, quality) => {
      dimensions.push([outputWidth, outputHeight])
      qualities.push(quality)
      return new Blob([new Uint8Array(sizes[attempt++] ?? 1)], { type: 'image/jpeg' })
    }),
  }
}

describe('prepareWhiteboardImage', () => {
  it('scales a landscape image and lowers quality until it fits', async () => {
    const fake = browser(4000, 3000, [5_500_000, 4_500_000])
    const result = await prepareWhiteboardImage(new File(['x'], 'board.png'), fake)
    expect(fake.dimensions).toEqual([[2400, 1800], [2400, 1800]])
    expect(fake.qualities).toEqual([0.9, 0.82])
    expect(result.type).toBe('image/jpeg')
    expect(result.size).toBe(4_500_000)
  })

  it('preserves portrait proportions and never upscales', async () => {
    const portrait = browser(3000, 4000, [100])
    await prepareWhiteboardImage(new File(['x'], 'portrait.jpg'), portrait)
    expect(portrait.dimensions[0]).toEqual([1800, 2400])

    const small = browser(800, 600, [100])
    await prepareWhiteboardImage(new File(['x'], 'small.jpg'), small)
    expect(small.dimensions[0]).toEqual([800, 600])
  })

  it('reports an image the browser cannot decode', async () => {
    const fake = browser(1, 1, [])
    fake.decode = vi.fn().mockRejectedValue(new Error('bad image'))
    await expect(prepareWhiteboardImage(new File(['x'], 'bad.heic'), fake)).rejects.toMatchObject({
      code: 'decode',
    })
  })

  it('reports images that remain too large after bounded attempts', async () => {
    const fake = browser(4000, 3000, [6_000_000, 6_000_000, 6_000_000, 6_000_000])
    await expect(prepareWhiteboardImage(new File(['x'], 'huge.jpg'), fake)).rejects.toEqual(
      new ImagePreparationError('too-large'),
    )
    expect(fake.qualities).toEqual([0.9, 0.82, 0.74, 0.66])
  })
})
