import { productName, t, type Lang } from '../lib/i18n'
import type { Product } from '../lib/types'

export type SendStatus = 'idle' | 'sending' | 'error'

interface Props {
  lang: Lang
  products: Product[]
  amounts: Record<number, number | null>
  counterName: string
  status: SendStatus
  onEdit: (index: number) => void
  onSend: () => void
  onBack: () => void
}

/**
 * Igual que la card: nada de objetivos. Se quitó también el resaltado en rojo
 * de las filas cortas, porque aunque no diga el número revela que se está por
 * debajo, y de ahí se deduce el objetivo.
 */
export function Review({
  lang,
  products,
  amounts,
  counterName,
  status,
  onEdit,
  onSend,
  onBack,
}: Props) {
  const s = t(lang)

  return (
    <>
      <h1>{s.reviewTitle}</h1>
      {counterName && <p className="progress">{counterName}</p>}

      {status === 'error' && <p className="error">{s.sendFailed}</p>}

      <table>
        <tbody>
          {products.map((product, index) => {
            const value = amounts[product.id]
            const counted = typeof value === 'number'
            return (
              <tr key={product.id}>
                <td>{productName(product, lang)}</td>
                <td className={counted ? 'num' : 'num skipped'}>
                  {counted ? value : s.notCountedLabel}
                </td>
                <td className="num">
                  <button type="button" className="ghost" onClick={() => onEdit(index)}>
                    {s.edit}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={onBack}
          disabled={status === 'sending'}
        >
          {s.back}
        </button>
        <button type="button" className="primary" onClick={onSend} disabled={status === 'sending'}>
          {status === 'sending' ? s.sending : status === 'error' ? s.retry : s.send}
        </button>
      </div>
    </>
  )
}
