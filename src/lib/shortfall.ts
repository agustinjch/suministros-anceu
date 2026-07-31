import type { CountEntry, Line, Product, Report } from './types'

/**
 * Cruza el catálogo con los conteos.
 *
 * El clamp a 0 en `buy` replica lo que hace el sistema actual de facto: la
 * fórmula del Google Sheet da negativos cuando sobra stock (Estrella Galicia:
 * 6 - 12 = -6) y `froiz-order-sync.v1.py` los descarta con `> 0`.
 */
export function buildReport(products: Product[], counts: CountEntry[]): Report {
  const byId = new Map(counts.map((c) => [c.id, c.amount]))

  const counted: Line[] = []
  const notCounted: Product[] = []

  for (const product of products) {
    const amount = byId.get(product.id)
    if (amount === undefined || amount === null) {
      notCounted.push(product)
      continue
    }
    counted.push({
      product,
      have: amount,
      buy: Math.max(0, product.target - amount),
    })
  }

  return {
    toBuy: counted.filter((line) => line.buy > 0),
    counted,
    notCounted,
  }
}
