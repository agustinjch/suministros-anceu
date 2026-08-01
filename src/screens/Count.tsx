import { LangToggle } from '../components/LangToggle'
import { ProductCard } from '../components/ProductCard'
import { t, type Lang, type Strings } from '../lib/i18n'
import type { Product, Zone } from '../lib/types'

const ZONE_KEY: Record<Zone, keyof Strings> = {
  cocina: 'zoneCocina',
  limpieza: 'zoneLimpieza',
  comida: 'zoneComida',
  bebidas: 'zoneBebidas',
  cafeteria: 'zoneCafeteria',
}

/**
 * Evita que el botón robe el foco al input, de modo que el teclado del móvil no
 * se cierre al pulsarlo. Va en `mousedown` y no en `pointerdown` a propósito:
 * `preventDefault` en mousedown impide el cambio de foco sin impedir el `click`,
 * que es un patrón viejo y estable; hacerlo en pointerdown suprime los eventos
 * de compatibilidad de ratón y hay navegadores donde el click se pierde.
 *
 * Es la mitad importante del arreglo: mantener el teclado abierto es fiable,
 * mientras que reabrirlo con un `focus()` programático depende de que Android
 * considere que sigues dentro del gesto del usuario.
 */
function keepFocusInInput(event: React.MouseEvent<HTMLButtonElement>): void {
  event.preventDefault()
}

interface Props {
  lang: Lang
  onLangChange: (lang: Lang) => void
  products: Product[]
  index: number
  amounts: Record<number, number | null>
  /** `null` = campo vacío: se borra la respuesta, no se marca como saltado. */
  onSet: (id: number, amount: number | null) => void
  onSkip: (id: number) => void
  onBack: () => void
  onNext: () => void
}

export function Count({
  lang,
  onLangChange,
  products,
  index,
  amounts,
  onSet,
  onSkip,
  onBack,
  onNext,
}: Props) {
  const s = t(lang)
  const product = products[index]
  const isLast = index === products.length - 1
  const value = amounts[product.id]
  const answered = typeof value === 'number'

  return (
    <>
      <div className="topbar">
        <p className="zone">{s[ZONE_KEY[product.location]]}</p>
        <p className="progress">
          {index + 1} {s.progress} {products.length}
        </p>
        <LangToggle lang={lang} onChange={onLangChange} />
      </div>

      <ProductCard
        product={product}
        lang={lang}
        value={value}
        onChange={(amount) => onSet(product.id, amount)}
        // Misma condición que el botón Siguiente: la tecla del teclado no puede
        // dejar avanzar donde el botón no deja.
        onEnter={() => {
          if (answered) onNext()
        }}
        enterKeyHint={isLast ? 'done' : 'next'}
      />

      <div className="actions">
        <button
          type="button"
          className="secondary"
          onMouseDown={keepFocusInInput}
          onClick={onBack}
          disabled={index === 0}
        >
          {s.back}
        </button>
        <button
          type="button"
          className="ghost"
          onMouseDown={keepFocusInInput}
          onClick={() => {
            onSkip(product.id)
            onNext()
          }}
        >
          {s.skip}
        </button>
        <button
          type="button"
          className="primary"
          onMouseDown={keepFocusInInput}
          onClick={onNext}
          disabled={!answered}
        >
          {isLast ? s.review : s.next}
        </button>
      </div>
    </>
  )
}
