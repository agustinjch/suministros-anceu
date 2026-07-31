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

interface Props {
  lang: Lang
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
      </div>

      <ProductCard
        product={product}
        lang={lang}
        value={value}
        onChange={(amount) => onSet(product.id, amount)}
      />

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack} disabled={index === 0}>
          {s.back}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            onSkip(product.id)
            onNext()
          }}
        >
          {s.skip}
        </button>
        <button type="button" className="primary" onClick={onNext} disabled={!answered}>
          {isLast ? s.review : s.next}
        </button>
      </div>
    </>
  )
}
