import { buildReport } from './shortfall'
import type { CountEntry, Product, Report } from './types'

/**
 * Fecha y hora en Europe/Madrid. Los Workers corren en UTC: un conteo a las
 * 00:30 saldría fechado el día anterior, y esa fecha va en el asunto.
 * El locale sv-SE da formato ISO ("2026-07-31 18:42") sin montar nada a mano.
 */
export function formatMadrid(now: Date): { date: string; time: string } {
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)
  const [date, time] = formatted.split(' ')
  return { date, time }
}

const NAME_WIDTH = 34
const COL_WIDTH = 14

function pad(text: string, width: number): string {
  return text.length >= width ? `${text} ` : text.padEnd(width)
}

function toBuySection(report: Report): string[] {
  const lines = [`TO BUY (${report.toBuy.length})`]
  if (report.toBuy.length === 0) {
    lines.push('Nothing to buy.')
    return lines
  }
  for (const { product, have, buy } of report.toBuy) {
    lines.push(
      pad(product.name, NAME_WIDTH) +
        pad(`have ${have}`, COL_WIDTH) +
        pad(`should be ${product.target}`, COL_WIDTH) +
        pad(`buy ${buy} ${product.unit}`, COL_WIDTH) +
        product.froiz_url,
    )
  }
  return lines
}

function inventorySection(report: Report): string[] {
  const lines = [`FULL INVENTORY (${report.counted.length} counted)`]
  for (const { product, have, buy } of report.counted) {
    // trimEnd: las filas sin "OK" acabarían en el relleno del padding.
    lines.push(
      (
        pad(product.name, NAME_WIDTH) +
        pad(`have ${have}`, COL_WIDTH) +
        pad(`should be ${product.target}`, COL_WIDTH) +
        (buy === 0 ? 'OK' : '')
      ).trimEnd(),
    )
  }
  return lines
}

function notCountedSection(report: Report): string[] {
  if (report.notCounted.length === 0) return []
  return [
    '',
    `NOT COUNTED (${report.notCounted.length})`,
    ...report.notCounted.map((product) => product.name),
  ]
}

export function buildEmail(
  products: Product[],
  counts: CountEntry[],
  counterName: string,
  now: Date,
): { subject: string; text: string } {
  const report = buildReport(products, counts)
  const { date, time } = formatMadrid(now)

  const count = report.toBuy.length
  const headline = count === 0 ? 'nothing to buy' : `${count} to buy`
  const subject = `[Anceu] Supplies — ${headline} (${date})`

  const who = counterName.trim() || '(not given)'
  const text = [
    `Counted by: ${who} — ${date} ${time}`,
    '',
    ...toBuySection(report),
    '',
    ...inventorySection(report),
    ...notCountedSection(report),
    '',
  ].join('\n')

  return { subject, text }
}
