import { useEffect, useRef, useState } from 'react'
import { productName, t, unitLabel, type Lang } from '../lib/i18n'
import type { Product } from '../lib/types'

interface Props {
  product: Product
  lang: Lang
  /** `number` contado · `null` saltado · `undefined` sin tocar. */
  value: number | null | undefined
  /** `null` significa "campo vacío", NO "saltado": eso lo hace el botón Saltar. */
  onChange: (amount: number | null) => void
  /**
   * Se llama al pulsar la tecla de acción del teclado. En el móvil es lo que
   * hace que el pulgar no tenga que salir del teclado para avanzar.
   */
  onEnter: () => void
  /** Etiqueta de la tecla de acción del teclado móvil. */
  enterKeyHint: 'next' | 'done'
}

/**
 * La card NO muestra `product.target` a propósito: quien cuenta no debe saber
 * cuánto debería haber, para que no ajuste el número a la expectativa. El
 * objetivo sólo aparece en el correo. La unidad sí se muestra, junto al input,
 * porque hace falta para saber si se cuentan botellas o packs.
 */
export function ProductCard({
  product,
  lang,
  value,
  onChange,
  onEnter,
  enterKeyHint,
}: Props) {
  const s = t(lang)
  const unit = unitLabel(product.unit, lang)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showDescription, setShowDescription] = useState(false)

  /**
   * Al pasar de producto React NO remonta esta card: reutiliza el mismo nodo
   * `<input>` y solo le cambia el valor. Por eso `autoFocus` no sirve — solo
   * actúa al montar. Sin esto, al pulsar "Siguiente" el foco se queda en el
   * botón, el teclado se cierra y la card siguiente sale sin teclado.
   *
   * Depende de `product.id` y no del índice, para que también funcione al
   * volver a una card concreta desde la pantalla de revisión.
   */
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    // Intento de seleccionar lo que ya hubiera, para que teclear lo reemplace en
    // vez de convertir un 3 en un 35. Es best-effort: la API de selección no
    // aplica formalmente a los input de tipo number, aunque Chrome la respeta.
    // Si el navegador la ignora, no pasa nada.
    input.select()
  }, [product.id])

  // La descripción vuelve a plegarse al cambiar de producto: el estado compacto
  // es el que debe salir por defecto en cada card.
  useEffect(() => {
    setShowDescription(false)
  }, [product.id])

  return (
    <div className="card">
      <img src={product.image} alt="" />
      {/*
        La (i) va en línea con el título, no en su propia fila: una fila extra
        costaría casi todo el alto que se gana plegando la descripción, que es el
        motivo de plegarla.
      */}
      <h2>
        {productName(product, lang)}{' '}
        <button
          type="button"
          className="info"
          aria-label={s.showDescription}
          aria-expanded={showDescription}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShowDescription((shown) => !shown)}
        >
          i
        </button>
      </h2>
      {showDescription && <p className="froiz-name">{product.froiz_name}</p>}
      <label>
        <span>{s.howMany}</span>
        <div className="amount">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            enterKeyHint={enterKeyHint}
            value={typeof value === 'number' ? value : ''}
            onChange={(event) => {
              const raw = event.target.value
              onChange(raw === '' ? null : Math.max(0, Math.trunc(Number(raw))))
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // El input no está en un <form>, así que Enter no hace nada por
                // sí solo. preventDefault de todos modos, por si algún día lo está.
                event.preventDefault()
                onEnter()
              }
            }}
          />
          <span className="unit">{unit}</span>
        </div>
      </label>
    </div>
  )
}
