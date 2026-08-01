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

  return (
    <div className="card">
      <img src={product.image} alt="" />
      <h2>{productName(product, lang)}</h2>
      <p className="froiz-name">{product.froiz_name}</p>
      <label>
        <span>{s.howMany}</span>
        <div className="amount">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            autoFocus
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
