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
  showDescription: string
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
  homeTitle: string
  homeIntro: string
  taskSupplies: string
  taskBeverages: string
  taskLaundry: string
  whiteboardIntro: string
  whiteboardRulePhoto: string
  whiteboardRuleReadable: string
  whiteboardRuleBlank: string
  whiteboardRuleErase: string
  nameRequired: string
  takePhoto: string
  chooseGallery: string
  photoRecommendation: string
  processingPhoto: string
  replacePhoto: string
  eraseNow: string
  eraseConfirmation: string
  sendWhiteboard: string
  whiteboardSendFailed: string
  photoInvalid: string
  photoSaveFailed: string
  discardDraft: string
  backHome: string
  whiteboardSentTitle: string
  whiteboardSentBody: string
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
  showDescription: 'Ver descripción',
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
  homeTitle: 'Tareas semanales',
  homeIntro: '¿Qué tarea vas a hacer?',
  taskSupplies: 'Suministros',
  taskBeverages: 'Pizarra de bebidas',
  taskLaundry: 'Pizarra de lavandería',
  whiteboardIntro: 'Haz una foto legible antes de borrar la pizarra.',
  whiteboardRulePhoto: 'Fotografía la pizarra antes de borrarla.',
  whiteboardRuleReadable: 'Amplía la foto y comprueba que todo se lee.',
  whiteboardRuleBlank: 'Aunque esté vacía, hay que fotografiarla.',
  whiteboardRuleErase: 'Bórrala completamente después de guardar una foto válida.',
  nameRequired: 'Escribe tu nombre para continuar.',
  takePhoto: 'Hacer una foto',
  chooseGallery: 'Elegir de la galería',
  photoRecommendation: 'Recomendamos usar primero la cámara normal para conservar una copia.',
  processingPhoto: 'Preparando y guardando la foto…',
  replacePhoto: 'Cambiar foto',
  eraseNow: 'La foto está guardada. Borra ahora la pizarra completamente.',
  eraseConfirmation: 'He borrado la pizarra',
  sendWhiteboard: 'Enviar whiteboard',
  whiteboardSendFailed: 'No se pudo enviar. La foto sigue guardada aquí.',
  photoInvalid: 'No pudimos leer esa imagen. Elige otra foto o una versión JPEG/PNG.',
  photoSaveFailed: 'No se pudo guardar la foto con seguridad. No borres todavía la pizarra.',
  discardDraft: 'Descartar borrador',
  backHome: '← Volver al inicio',
  whiteboardSentTitle: '¡Pizarra enviada!',
  whiteboardSentBody: 'La foto ya está en hello@anceu.com. Gracias.',
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
  showDescription: 'Show description',
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
  homeTitle: 'Weekly tasks',
  homeIntro: 'Which task are you doing?',
  taskSupplies: 'Supplies',
  taskBeverages: 'Beverage whiteboard',
  taskLaundry: 'Laundry whiteboard',
  whiteboardIntro: 'Take a readable photo before erasing the whiteboard.',
  whiteboardRulePhoto: 'Photograph the whiteboard before erasing it.',
  whiteboardRuleReadable: 'Zoom in and check that all writing is readable.',
  whiteboardRuleBlank: 'A blank whiteboard still requires a photo.',
  whiteboardRuleErase: 'Erase it completely after a valid photo is safely stored.',
  nameRequired: 'Enter your name to continue.',
  takePhoto: 'Take a photo',
  chooseGallery: 'Choose from gallery',
  photoRecommendation: 'We recommend using the normal camera first so a copy stays in your gallery.',
  processingPhoto: 'Preparing and saving the photo…',
  replacePhoto: 'Replace photo',
  eraseNow: 'The photo is saved. Now erase the whiteboard completely.',
  eraseConfirmation: 'I have erased the whiteboard',
  sendWhiteboard: 'Send whiteboard',
  whiteboardSendFailed: 'Could not send. The photo is still saved here.',
  photoInvalid: 'We could not read that image. Choose another photo or a JPEG/PNG version.',
  photoSaveFailed: 'The photo could not be stored safely. Do not erase the whiteboard yet.',
  discardDraft: 'Discard draft',
  backHome: '← Back to home',
  whiteboardSentTitle: 'Whiteboard sent!',
  whiteboardSentBody: 'The photo is now in hello@anceu.com. Thanks.',
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
