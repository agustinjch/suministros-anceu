import { ZONES, type CountEntry, type Product, type Session } from './types'

const KEY = 'suministros-anceu:session'
const NAME_KEY = 'suministros-anceu:person-name'
const MAX_NAME = 80

export function loadRememberedName(): string {
  try {
    return (localStorage.getItem(NAME_KEY) ?? '').trim().slice(0, MAX_NAME)
  } catch {
    return ''
  }
}

export function saveRememberedName(name: string): void {
  const normalized = name.trim().slice(0, MAX_NAME)
  if (!normalized) return
  try {
    localStorage.setItem(NAME_KEY, normalized)
  } catch {
    // El nombre es una comodidad; la tarea puede seguir si el navegador no guarda.
  }
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return typeof s.counterName === 'string' && typeof s.amounts === 'object' && s.amounts !== null
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Se llama en cada cambio. Alguien va a bloquear el móvil en el producto 20;
 * sin esto pierde el conteo entero y no lo repite. Un fallo de cuota no debe
 * tumbar la app: se sigue contando en memoria.
 */
export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Cuota llena o Safari privado. Seguir.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que hacer.
  }
}

export function toCountEntries(session: Session): CountEntry[] {
  return Object.entries(session.amounts).map(([id, amount]) => ({ id: Number(id), amount }))
}

/** Ordena por el recorrido físico de la casa, estable dentro de cada zona. */
export function sortByZone(products: Product[]): Product[] {
  return [...products].sort((a, b) => ZONES.indexOf(a.location) - ZONES.indexOf(b.location))
}
