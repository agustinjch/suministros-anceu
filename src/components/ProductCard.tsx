import { productName, t, unitLabel, type Lang } from '../lib/i18n'
import type { Product } from '../lib/types'

interface Props {
  product: Product
  lang: Lang
  /** `number` contado · `null` saltado · `undefined` sin tocar. */
  value: number | null | undefined
  /** `null` significa "campo vacío", NO "saltado": eso lo hace el botón Saltar. */
  onChange: (amount: number | null) => void
}

export function ProductCard({ product, lang, value, onChange }: Props) {
  const s = t(lang)
  const unit = unitLabel(product.unit, lang)

  return (
    <div className="card">
      <img src={product.image} alt="" />
      <h2>{productName(product, lang)}</h2>
      <p className="froiz-name">{product.froiz_name}</p>
      <p className="target">
        {s.shouldBe}: {product.target} {unit}
      </p>
      <label>
        <span>{s.howMany}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          autoFocus
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => {
            const raw = event.target.value
            onChange(raw === '' ? null : Math.max(0, Math.trunc(Number(raw))))
          }}
        />
      </label>
    </div>
  )
}
