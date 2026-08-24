import { useEffect, useState } from 'react'
import { ImagePreparationError, prepareWhiteboardImage } from '../lib/image'
import { t, type Lang } from '../lib/i18n'
import { loadRememberedName, saveRememberedName } from '../lib/storage'
import {
  clearWhiteboardDraft,
  loadWhiteboardDraft,
  saveWhiteboardDraft,
  type WhiteboardDraft,
} from '../lib/whiteboard-drafts'
import type { WhiteboardType } from '../lib/whiteboards'

export interface WhiteboardDependencies {
  prepare(file: File): Promise<Blob>
  load(board: WhiteboardType): Promise<WhiteboardDraft | null>
  save(draft: WhiteboardDraft): Promise<void>
  clear(board: WhiteboardType): Promise<void>
  send(request: { body: FormData }): Promise<Response>
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
}

const defaults: WhiteboardDependencies = {
  prepare: prepareWhiteboardImage,
  load: loadWhiteboardDraft,
  save: saveWhiteboardDraft,
  clear: clearWhiteboardDraft,
  send: ({ body }) => fetch('/api/whiteboards', { method: 'POST', body }),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
}

interface Props {
  board: WhiteboardType
  lang: Lang
  onHome: () => void
  onSent: () => void
  deps?: WhiteboardDependencies
}

type Status = 'idle' | 'loading' | 'processing' | 'sending' | 'error'

export function Whiteboard({ board, lang, onHome, onSent, deps = defaults }: Props) {
  const s = t(lang)
  const boardName = board === 'beverages' ? s.taskBeverages : s.taskLaundry
  const [completedBy, setCompletedBy] = useState(loadRememberedName)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [erased, setErased] = useState(false)
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    deps.load(board).then((draft) => {
      if (!active) return
      if (draft) {
        setCompletedBy(draft.completedBy)
        setPhoto(draft.photo)
        setErased(draft.erased)
      }
      setStatus('idle')
    }).catch(() => {
      if (active) {
        setStatus('idle')
        setMessage(s.photoSaveFailed)
      }
    })
    return () => { active = false }
  }, [board, deps, s.photoSaveFailed])

  useEffect(() => {
    if (!photo) {
      setPreview('')
      return
    }
    const url = deps.createObjectURL(photo)
    setPreview(url)
    return () => deps.revokeObjectURL(url)
  }, [photo, deps])

  function changeName(value: string) {
    setCompletedBy(value)
    const normalized = value.trim().slice(0, 80)
    if (normalized) saveRememberedName(normalized)
    if (photo && normalized) {
      void deps.save({ board, completedBy: normalized, erased, photo, updatedAt: Date.now() })
        .catch(() => setMessage(s.photoSaveFailed))
    }
  }

  async function choosePhoto(file?: File) {
    const name = completedBy.trim().slice(0, 80)
    if (!name) {
      setMessage(s.nameRequired)
      return
    }
    if (!file) return
    setStatus('processing')
    setMessage('')
    try {
      const prepared = await deps.prepare(file)
      const draft = { board, completedBy: name, erased: false, photo: prepared, updatedAt: Date.now() }
      await deps.save(draft)
      saveRememberedName(name)
      setPhoto(prepared)
      setErased(false)
      setStatus('idle')
    } catch (error) {
      setStatus('idle')
      setMessage(error instanceof ImagePreparationError ? s.photoInvalid : s.photoSaveFailed)
    }
  }

  async function changeErased(value: boolean) {
    if (!photo) return
    const name = completedBy.trim().slice(0, 80)
    try {
      await deps.save({ board, completedBy: name, erased: value, photo, updatedAt: Date.now() })
      setErased(value)
      setMessage('')
    } catch {
      setMessage(s.photoSaveFailed)
    }
  }

  async function send() {
    if (!photo || !erased || !completedBy.trim()) return
    setStatus('sending')
    setMessage('')
    const body = new FormData()
    body.append('board', board)
    body.append('completed_by', completedBy.trim().slice(0, 80))
    body.append('erased', 'true')
    body.append('photo', photo, `${board}-whiteboard.jpg`)
    try {
      const response = await deps.send({ body })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await deps.clear(board)
      onSent()
    } catch {
      setStatus('error')
      setMessage(s.whiteboardSendFailed)
    }
  }

  async function discard() {
    if (!window.confirm(s.discardDraft)) return
    await deps.clear(board)
    onHome()
  }

  const canSend = Boolean(completedBy.trim() && photo && erased && status !== 'sending')
  return (
    <>
      <button type="button" className="back-home" onClick={onHome}>{s.backHome}</button>
      <p className="zone">{boardName}</p>
      <h1>{s.whiteboardIntro}</h1>
      <ul className="instructions">
        <li>{s.whiteboardRulePhoto}</li><li>{s.whiteboardRuleReadable}</li>
        <li>{s.whiteboardRuleBlank}</li><li>{s.whiteboardRuleErase}</li>
      </ul>
      <label><span>{s.yourName}</span><input type="text" maxLength={80} value={completedBy} onChange={(e) => changeName(e.target.value)} /></label>
      <p className="progress">{s.photoRecommendation}</p>
      <div className="photo-picker">
        <label className="secondary file-button">{s.takePhoto}<input aria-label={s.takePhoto} type="file" accept="image/*" capture="environment" onChange={(e) => void choosePhoto(e.target.files?.[0])} /></label>
        <label className="secondary file-button">{photo ? s.replacePhoto : s.chooseGallery}<input aria-label={s.chooseGallery} type="file" accept="image/*" onChange={(e) => void choosePhoto(e.target.files?.[0])} /></label>
      </div>
      <div className="status" aria-live="polite">
        {status === 'processing' && s.processingPhoto}
        {message && <p className="error">{message}</p>}
      </div>
      {preview && <a href={preview} target="_blank" rel="noreferrer"><img className="photo-preview" src={preview} alt={`${boardName}`} /></a>}
      {photo && <label className="confirmation"><input type="checkbox" checked={erased} onChange={(e) => void changeErased(e.target.checked)} /><span><strong>{s.eraseNow}</strong><br />{s.eraseConfirmation}</span></label>}
      <div className="actions">
        <button type="button" className="primary" disabled={!canSend} onClick={() => void send()}>{status === 'sending' ? s.sending : status === 'error' ? s.retry : s.sendWhiteboard}</button>
      </div>
      {photo && <button type="button" className="ghost discard" onClick={() => void discard()}>{s.discardDraft}</button>}
    </>
  )
}
