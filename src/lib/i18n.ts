import type { Product, Unit } from './types'

export type Lang = 'es' | 'en'

export const DEFAULT_LANG: Lang = 'es'

const LANG_KEY = 'suministros-anceu:lang'

/** Exportado: `Count.tsx` indexa por `keyof Strings` para mapear zonas a textos. */
export interface Strings {
  appTitle: string
  intro: string
  yourName: string
  yourNamePlaceholder: string
  start: string
  resume: string
  startOver: string
  howMany: string
  skip: string
  back: string
  next: string
  review: string
  reviewTitle: string
  notCountedLabel: string
  edit: string
  send: string
  sending: string
  sendFailed: string
  retry: string
  sentTitle: string
  sentBody: string
  progress: string
  products: string
  zoneCocina: string
  zoneLimpieza: string
  zoneComida: string
  zoneBebidas: string
  zoneCafeteria: string
}

const ES: Strings = {
  appTitle: 'Suministros Anceu',
  intro: 'Recorre la casa y anota cuánto hay de cada cosa.',
  yourName: 'Tu nombre',
  yourNamePlaceholder: 'opcional',
  start: 'Empezar',
  resume: 'Continuar donde lo dejaste',
  startOver: 'Empezar de cero',
  howMany: '¿Cuántos hay?',
  skip: 'Saltar',
  back: 'Atrás',
  next: 'Siguiente',
  review: 'Revisar',
  reviewTitle: 'Revisa antes de enviar',
  notCountedLabel: 'sin contar',
  edit: 'Cambiar',
  send: 'Enviar',
  sending: 'Enviando…',
  sendFailed: 'No se pudo enviar. Tus datos siguen aquí.',
  retry: 'Reintentar',
  sentTitle: '¡Enviado!',
  sentBody: 'El inventario ya está en hello@anceu.com. Gracias.',
  progress: 'de',
  products: 'productos',
  zoneCocina: 'Cocina',
  zoneLimpieza: 'Limpieza',
  zoneComida: 'Comida',
  zoneBebidas: 'Bebidas',
  zoneCafeteria: 'Cafetería',
}

const EN: Strings = {
  appTitle: 'Anceu Supplies',
  intro: 'Walk through the house and note how much there is of each item.',
  yourName: 'Your name',
  yourNamePlaceholder: 'optional',
  start: 'Start',
  resume: 'Resume where you left off',
  startOver: 'Start over',
  howMany: 'How many are there?',
  skip: 'Skip',
  back: 'Back',
  next: 'Next',
  review: 'Review',
  reviewTitle: 'Check before sending',
  notCountedLabel: 'not counted',
  edit: 'Change',
  send: 'Send',
  sending: 'Sending…',
  sendFailed: 'Could not send. Your data is still here.',
  retry: 'Retry',
  sentTitle: 'Sent!',
  sentBody: 'The inventory is now in hello@anceu.com. Thanks.',
  progress: 'of',
  products: 'products',
  zoneCocina: 'Kitchen',
  zoneLimpieza: 'Cleaning',
  zoneComida: 'Food',
  zoneBebidas: 'Drinks',
  zoneCafeteria: 'Coffee bar',
}

export function t(lang: Lang): Strings {
  return lang === 'en' ? EN : ES
}

/** Cae al español si falta la traducción: mejor un nombre en español que un hueco. */
export function productName(product: Product, lang: Lang): string {
  if (lang === 'en' && product.name_en) return product.name_en
  return product.name
}

const UNITS: Record<Unit, Record<Lang, string>> = {
  ud: { es: 'ud', en: 'units' },
  pack: { es: 'packs', en: 'packs' },
  bolsa: { es: 'bolsas', en: 'bags' },
  kg: { es: 'kg', en: 'kg' },
}

export function unitLabel(unit: Unit, lang: Lang): string {
  return UNITS[unit][lang]
}

export function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'
  } catch {
    return DEFAULT_LANG
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // Safari en modo privado lanza. El idioma no es crítico: seguir.
  }
}
