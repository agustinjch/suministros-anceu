export type Unit = 'ud' | 'pack' | 'bolsa' | 'kg'

export type Zone =
  | 'armario_limpieza'
  | 'despensa'
  | 'cafeteria'
  | 'armario_despensa'
  | 'congelador'
  | 'cocina'

/** Orden de recorrido de la casa. No reordenar sin motivo: es el camino físico. */
export const ZONES: readonly Zone[] = [
  'armario_limpieza',
  'despensa',
  'cafeteria',
  'armario_despensa',
  'congelador',
  'cocina',
]

export interface Product {
  id: number
  /** Nombre en español, como lo llama la casa. */
  name: string
  name_en: string
  /** Nombre canónico de Froiz. Se muestra pequeño bajo el principal. */
  froiz_name: string
  froiz_url: string
  /** Ruta local, p. ej. "/img/21716.jpg". */
  image: string
  target: number
  unit: Unit
  location: Zone
}

/** `amount: null` significa no contado, que NO es lo mismo que contado a cero. */
export interface CountEntry {
  id: number
  amount: number | null
}

export interface Line {
  product: Product
  have: number
  /** max(0, target - have) */
  buy: number
}

export interface Report {
  /** Subconjunto de `counted` con buy > 0, en orden de catálogo. */
  toBuy: Line[]
  /** Todos los productos contados, en orden de catálogo. */
  counted: Line[]
  /** Productos sin conteo (amount null o ausente), en orden de catálogo. */
  notCounted: Product[]
}

export interface SendRequest {
  counter_name: string
  counts: CountEntry[]
}

/** Estado del conteo en curso. Vive en localStorage hasta que se envía. */
export interface Session {
  counterName: string
  /** Clave: id de producto. `null` = saltado explícitamente. */
  amounts: Record<number, number | null>
}
