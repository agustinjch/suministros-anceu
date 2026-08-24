import { t, type Lang } from '../lib/i18n'

interface Props {
  lang: Lang
  total: number
  counterName: string
  hasSaved: boolean
  onNameChange: (name: string) => void
  onStart: () => void
  onResume: () => void
  onStartOver: () => void
  onHome: () => void
}

export function Start({
  lang,
  total,
  counterName,
  hasSaved,
  onNameChange,
  onStart,
  onResume,
  onStartOver,
  onHome,
}: Props) {
  const s = t(lang)

  return (
    <>
      <button type="button" className="back-home" onClick={onHome}>{s.backHome}</button>
      <h1>{s.appTitle}</h1>
      <p>{s.intro}</p>
      <p className="progress">
        {total} {s.products}
      </p>

      <label>
        <span>{s.yourName}</span>
        <input
          type="text"
          value={counterName}
          placeholder={s.yourNamePlaceholder}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      {hasSaved ? (
        <div className="actions">
          <button type="button" className="primary" onClick={onResume}>
            {s.resume}
          </button>
          <button type="button" className="ghost" onClick={onStartOver}>
            {s.startOver}
          </button>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="primary" onClick={onStart}>
            {s.start}
          </button>
        </div>
      )}
    </>
  )
}
