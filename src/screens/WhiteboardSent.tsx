import { t, type Lang } from '../lib/i18n'

export function WhiteboardSent({ lang, onHome }: { lang: Lang; onHome: () => void }) {
  const s = t(lang)
  return <><h1>{s.whiteboardSentTitle}</h1><p>{s.whiteboardSentBody}</p><button type="button" className="primary" onClick={onHome}>{s.backHome}</button></>
}
