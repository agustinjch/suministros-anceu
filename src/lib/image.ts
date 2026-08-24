const MAX_EDGE = 2400
const MAX_BYTES = 5_000_000
const QUALITIES = [0.9, 0.82, 0.74, 0.66] as const

export type ImagePreparationErrorCode = 'decode' | 'canvas' | 'too-large'

export class ImagePreparationError extends Error {
  constructor(public readonly code: ImagePreparationErrorCode) {
    super(code)
    this.name = 'ImagePreparationError'
  }
}

interface DecodedImage {
  width: number
  height: number
  source: CanvasImageSource
  close(): void
}

export interface ImageBrowser {
  decode(file: File): Promise<DecodedImage>
  encode(
    source: CanvasImageSource,
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob | null>
}

const defaultBrowser: ImageBrowser = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() }
  },
  async encode(source, width, height, quality) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(source, 0, 0, width, height)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  },
}

export async function prepareWhiteboardImage(
  file: File,
  browser: ImageBrowser = defaultBrowser,
): Promise<Blob> {
  let decoded: DecodedImage
  try {
    decoded = await browser.decode(file)
  } catch {
    throw new ImagePreparationError('decode')
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height))
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))

    for (const quality of QUALITIES) {
      const blob = await browser.encode(decoded.source, width, height, quality)
      if (!blob) throw new ImagePreparationError('canvas')
      if (blob.size <= MAX_BYTES) return blob
    }
    throw new ImagePreparationError('too-large')
  } finally {
    decoded.close()
  }
}
