import { t, type Lang } from '../lib/i18n'

export function Sent({ lang }: { lang: Lang }) {
  const s = t(lang)
  return (
    <>
      <h1>{s.sentTitle}</h1>
      <p>{s.sentBody}</p>
    </>
  )
}
