import type { Lang } from '../lib/i18n'

/**
 * Vive en su propio componente porque se coloca en dos sitios: en la pantalla de
 * conteo va dentro del topbar, junto a la zona y el progreso, para no gastar una
 * fila entera de alto (con el teclado abierto el alto es lo que falta). En las
 * demás pantallas va suelto arriba.
 */
export function LangToggle({
  lang,
  onChange,
}: {
  lang: Lang
  onChange: (lang: Lang) => void
}) {
  return (
    <div className="lang">
      <button type="button" aria-pressed={lang === 'es'} onClick={() => onChange('es')}>
        ES
      </button>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => onChange('en')}>
        EN
      </button>
    </div>
  )
}
