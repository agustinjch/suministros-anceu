/** Catálogo público de Froiz. No requiere login. */
const API = 'https://servicios.froiz.com/api/products'
const STORE = 'https://supermercado.froiz.com/product'
const IMAGES = 'https://imagedelivery.net'

export interface FroizProduct {
  id: number
  name: string
  slug: string
  /** Ruta de Cloudflare Images con firma, p. ej. "/{hash}/{image_id}/desktop?exp=…&sig=…". */
  image: string
  measurement_unit: string
  per_unit: boolean
  fractional: boolean
}

export async function fetchFroizProduct(id: number): Promise<FroizProduct> {
  const res = await fetch(`${API}/${id}`, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`Froiz ${id}: HTTP ${res.status}`)
  }
  return (await res.json()) as FroizProduct
}

export function froizProductUrl(product: FroizProduct): string {
  return `${STORE}/${product.slug}`
}

/**
 * Se usa la ruta firmada tal como la devuelve la API en vez de reconstruirla
 * desde `image_id`: así no hay que hardcodear el hash de cuenta de Cloudflare
 * Images de Froiz, y la firma está recién emitida cuando descargamos.
 */
export function froizImageUrl(product: FroizProduct): string {
  return `${IMAGES}${product.image}`
}
