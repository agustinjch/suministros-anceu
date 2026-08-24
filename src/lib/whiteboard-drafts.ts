import type { WhiteboardType } from './whiteboards'

const DATABASE = 'suministros-anceu'
const STORE = 'whiteboard-drafts'

export interface WhiteboardDraft {
  board: WhiteboardType
  completedBy: string
  erased: boolean
  photo: Blob
  updatedAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'board' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function validDraft(value: unknown, board: WhiteboardType): value is WhiteboardDraft {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<WhiteboardDraft>
  return (
    item.board === board &&
    typeof item.completedBy === 'string' &&
    item.completedBy.trim().length > 0 &&
    item.completedBy.length <= 80 &&
    typeof item.erased === 'boolean' &&
    typeof item.photo === 'object' &&
    item.photo !== null &&
    item.photo.type === 'image/jpeg' &&
    typeof item.photo.size === 'number' &&
    Number.isFinite(item.updatedAt)
  )
}

async function useStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await requestResult(run(db.transaction(STORE, mode).objectStore(STORE)))
  } finally {
    db.close()
  }
}

export async function loadWhiteboardDraft(board: WhiteboardType): Promise<WhiteboardDraft | null> {
  const value: unknown = await useStore('readonly', (store) => store.get(board))
  if (value === undefined) return null
  if (!validDraft(value, board)) {
    await clearWhiteboardDraft(board)
    return null
  }
  return value
}

export async function saveWhiteboardDraft(draft: WhiteboardDraft): Promise<void> {
  await useStore('readwrite', (store) => store.put(draft))
}

export async function clearWhiteboardDraft(board: WhiteboardType): Promise<void> {
  await useStore('readwrite', (store) => store.delete(board))
}
