import { t, type Lang } from '../lib/i18n'
import type { WhiteboardType } from '../lib/whiteboards'

interface Props {
  lang: Lang
  onSupplies: () => void
  onWhiteboard: (board: WhiteboardType) => void
}

export function Home({ lang, onSupplies, onWhiteboard }: Props) {
  const s = t(lang)
  return (
    <>
      <h1>{s.homeTitle}</h1>
      <p>{s.homeIntro}</p>
      <div className="task-grid">
        <button type="button" className="task-button" onClick={onSupplies}>{s.taskSupplies}</button>
        <button type="button" className="task-button" onClick={() => onWhiteboard('beverages')}>{s.taskBeverages}</button>
        <button type="button" className="task-button" onClick={() => onWhiteboard('laundry')}>{s.taskLaundry}</button>
      </div>
    </>
  )
}
