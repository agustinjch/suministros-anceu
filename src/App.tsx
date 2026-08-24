import { useEffect, useMemo, useState } from 'react'
import { LangToggle } from './components/LangToggle'
import { loadLang, saveLang, type Lang } from './lib/i18n'
import { clearSession, loadRememberedName, loadSession, saveRememberedName, saveSession, sortByZone, toCountEntries } from './lib/storage'
import productsJson from './products.json'
import { Count } from './screens/Count'
import { Review, type SendStatus } from './screens/Review'
import { Sent } from './screens/Sent'
import { Start } from './screens/Start'
import { Home } from './screens/Home'
import { Whiteboard } from './screens/Whiteboard'
import { WhiteboardSent } from './screens/WhiteboardSent'
import './styles.css'
import type { Product, Session } from './lib/types'
import type { WhiteboardType } from './lib/whiteboards'

type Screen = 'home' | 'start' | 'count' | 'review' | 'sent' | 'whiteboard' | 'whiteboard-sent'

const EMPTY: Session = { counterName: '', amounts: {} }

export function App() {
  const products = useMemo(() => sortByZone(productsJson as Product[]), [])

  const [lang, setLang] = useState<Lang>(loadLang)
  const [screen, setScreen] = useState<Screen>('home')
  const [index, setIndex] = useState(0)
  const [session, setSession] = useState<Session>(EMPTY)
  const [saved, setSaved] = useState<Session | null>(loadSession)
  const [status, setStatus] = useState<SendStatus>('idle')
  const [whiteboard, setWhiteboard] = useState<WhiteboardType>('beverages')

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
      {/*
        En la pantalla de conteo el toggle va dentro del topbar de Count, junto a
        la zona y el progreso, para no gastar una fila entera de alto: con el
        teclado abierto el alto es justo lo que falta.
      */}
      {screen !== 'count' && <LangToggle lang={lang} onChange={setLang} />}

      {screen === 'home' && (
        <Home
          lang={lang}
          onSupplies={() => {
            if (!saved && !session.counterName) {
              setSession({ ...session, counterName: loadRememberedName() })
            }
            setScreen('start')
          }}
          onWhiteboard={(board) => {
            setWhiteboard(board)
            setScreen('whiteboard')
          }}
        />
      )}

      {screen === 'start' && (
        <Start
          lang={lang}
          total={products.length}
          counterName={session.counterName}
          hasSaved={saved !== null}
          onNameChange={(counterName) => {
            persist({ ...session, counterName })
            if (counterName.trim()) saveRememberedName(counterName)
          }}
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
          onHome={() => setScreen('home')}
        />
      )}

      {screen === 'count' && (
        <Count
          lang={lang}
          onLangChange={setLang}
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

      {screen === 'sent' && <Sent lang={lang} onHome={() => setScreen('home')} />}

      {screen === 'whiteboard' && (
        <Whiteboard
          board={whiteboard}
          lang={lang}
          onHome={() => setScreen('home')}
          onSent={() => setScreen('whiteboard-sent')}
        />
      )}

      {screen === 'whiteboard-sent' && (
        <WhiteboardSent lang={lang} onHome={() => setScreen('home')} />
      )}
    </main>
  )
}
