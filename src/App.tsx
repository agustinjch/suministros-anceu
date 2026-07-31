import { useEffect, useMemo, useState } from 'react'
import { loadLang, saveLang, type Lang } from './lib/i18n'
import { clearSession, loadSession, saveSession, sortByZone, toCountEntries } from './lib/storage'
import productsJson from './products.json'
import { Count } from './screens/Count'
import { Review, type SendStatus } from './screens/Review'
import { Sent } from './screens/Sent'
import { Start } from './screens/Start'
import './styles.css'
import type { Product, Session } from './lib/types'

type Screen = 'start' | 'count' | 'review' | 'sent'

const EMPTY: Session = { counterName: '', amounts: {} }

export function App() {
  const products = useMemo(() => sortByZone(productsJson as Product[]), [])

  const [lang, setLang] = useState<Lang>(loadLang)
  const [screen, setScreen] = useState<Screen>('start')
  const [index, setIndex] = useState(0)
  const [session, setSession] = useState<Session>(EMPTY)
  const [saved, setSaved] = useState<Session | null>(null)
  const [status, setStatus] = useState<SendStatus>('idle')

  useEffect(() => {
    setSaved(loadSession())
  }, [])

  useEffect(() => {
    saveLang(lang)
  }, [lang])

  function persist(next: Session): void {
    setSession(next)
    saveSession(next)
  }

  /**
   * Tres estados distintos, tres representaciones:
   * `number` contado · `null` saltado · clave ausente sin tocar.
   * Vaciar el input borra la clave; no marca como saltado.
   */
  function setAmount(id: number, amount: number | null): void {
    const amounts = { ...session.amounts }
    if (amount === null) {
      delete amounts[id]
    } else {
      amounts[id] = amount
    }
    persist({ ...session, amounts })
  }

  function skip(id: number): void {
    persist({ ...session, amounts: { ...session.amounts, [id]: null } })
  }

  function goNext(): void {
    if (index < products.length - 1) {
      setIndex(index + 1)
    } else {
      setScreen('review')
    }
  }

  async function send(): Promise<void> {
    setStatus('sending')
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          counter_name: session.counterName,
          counts: toCountEntries(session),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Sólo aquí se borra: antes de que Resend confirme, los datos se quedan.
      clearSession()
      setSaved(null)
      setStatus('idle')
      setScreen('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="app">
      <div className="lang">
        <button type="button" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>
          ES
        </button>
        <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
          EN
        </button>
      </div>

      {screen === 'start' && (
        <Start
          lang={lang}
          total={products.length}
          counterName={session.counterName}
          hasSaved={saved !== null}
          onNameChange={(counterName) => persist({ ...session, counterName })}
          onStart={() => setScreen('count')}
          onResume={() => {
            if (saved) setSession(saved)
            setScreen('count')
          }}
          onStartOver={() => {
            clearSession()
            setSaved(null)
            setSession(EMPTY)
            setScreen('count')
          }}
        />
      )}

      {screen === 'count' && (
        <Count
          lang={lang}
          products={products}
          index={index}
          amounts={session.amounts}
          onSet={setAmount}
          onSkip={skip}
          onBack={() => setIndex(Math.max(0, index - 1))}
          onNext={goNext}
        />
      )}

      {screen === 'review' && (
        <Review
          lang={lang}
          products={products}
          amounts={session.amounts}
          counterName={session.counterName}
          status={status}
          onEdit={(target) => {
            setStatus('idle')
            setIndex(target)
            setScreen('count')
          }}
          onSend={send}
          onBack={() => {
            setStatus('idle')
            setScreen('count')
          }}
        />
      )}

      {screen === 'sent' && <Sent lang={lang} />}
    </main>
  )
}
