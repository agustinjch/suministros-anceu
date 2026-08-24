import { formatMadrid } from '../src/lib/email'
import { WHITEBOARDS, type WhiteboardType } from '../src/lib/whiteboards'

const FIELDS = new Set(['board', 'completed_by', 'erased', 'photo'])
const MAX_PHOTO_BYTES = 5_000_000

export interface WhiteboardSubmission {
  board: WhiteboardType
  completedBy: string
  erased: true
  photo: File
}

export class WhiteboardValidationError extends Error {}

function fail(message: string): never {
  throw new WhiteboardValidationError(message)
}

function one(form: FormData, key: string): FormDataEntryValue {
  const values = form.getAll(key)
  if (values.length !== 1) fail(`${key} must appear exactly once`)
  return values[0]
}

export async function parseWhiteboardForm(form: FormData): Promise<WhiteboardSubmission> {
  for (const key of form.keys()) {
    if (!FIELDS.has(key)) fail(`unknown field ${key}`)
  }

  const boardValue = one(form, 'board')
  if (boardValue !== 'beverages' && boardValue !== 'laundry') fail('invalid board')

  const nameValue = one(form, 'completed_by')
  if (typeof nameValue !== 'string') fail('completed_by must be text')
  const completedBy = nameValue.trim()
  if (!completedBy || completedBy.length > 80) fail('completed_by out of range')

  if (one(form, 'erased') !== 'true') fail('whiteboard must be erased')
  const photo = one(form, 'photo')
  if (!(photo instanceof File) || photo.type !== 'image/jpeg') fail('photo must be a JPEG')
  if (photo.size > MAX_PHOTO_BYTES) fail('photo too large')
  const signature = new Uint8Array(await photo.slice(0, 3).arrayBuffer())
  if (signature.length !== 3 || signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
    fail('invalid JPEG signature')
  }
  return { board: boardValue, completedBy, erased: true, photo }
}

export function buildWhiteboardEmail(submission: WhiteboardSubmission, now: Date) {
  const { date, time } = formatMadrid(now)
  const config = WHITEBOARDS[submission.board]
  return {
    subject: `[Anceu] Weekly whiteboard — ${config.emailLabel} — ${date}`,
    text: [
      `Board: ${config.emailLabel}`,
      `Completed by: ${submission.completedBy}`,
      `Completed at: ${date} ${time} Europe/Madrid`,
      'Whiteboard erased: Yes',
      '',
    ].join('\n'),
    filename: `${config.filename}-${date}.jpg`,
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32_768)))
  }
  return btoa(chunks.join(''))
}
