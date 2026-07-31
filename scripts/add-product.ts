import { appendFileSync, readFileSync } from 'node:fs'
import { ZONES, type Unit, type Zone } from '../src/lib/types'
import { fetchFroizProduct } from './froiz'

const SEED = new URL('./seed.tsv', import.meta.url)
const UNITS: Unit[] = ['ud', 'pack', 'bolsa', 'kg']

export function productIdFromUrl(url: string): number {
  const match = /\/product\/(\d+)/.exec(url)
  if (!match) throw new Error(`No es una url de producto de Froiz: ${url}`)
  return Number(match[1])
}

export function seedLine(
  id: number,
  zone: Zone,
  target: number,
  unit: Unit,
  name: string,
  nameEn: string,
): string {
  for (const value of [name, nameEn]) {
    if (value.includes('\t')) throw new Error(`El nombre no puede llevar un tab: ${value}`)
  }
  return [id, zone, target, unit, name, nameEn].join('\t')
}

async function main(): Promise<void> {
  const [url, zone, target, unit, name, nameEn] = process.argv.slice(2)
  if (!url || !zone || !target || !unit || !name || !nameEn) {
    throw new Error(
      'Uso: npm run add -- <url-froiz> <zona> <objetivo> <unidad> "<nombre es>" "<nombre en>"',
    )
  }
  if (!ZONES.includes(zone as Zone)) {
    throw new Error(`Zona desconocida: ${zone} (${ZONES.join(', ')})`)
  }
  if (!UNITS.includes(unit as Unit)) {
    throw new Error(`Unidad desconocida: ${unit} (${UNITS.join(', ')})`)
  }

  const id = productIdFromUrl(url)
  if (
    readFileSync(SEED, 'utf8')
      .split('\n')
      .some((line) => line.startsWith(`${id}\t`))
  ) {
    throw new Error(`El producto ${id} ya está en seed.tsv`)
  }

  // Se consulta la API antes de escribir: si el producto no existe o está
  // descatalogado, mejor enterarse ahora que en el próximo build del catálogo.
  const froiz = await fetchFroizProduct(id)
  console.log(`Froiz dice: ${froiz.name} (${froiz.measurement_unit})`)

  appendFileSync(SEED, `${seedLine(id, zone as Zone, Number(target), unit as Unit, name, nameEn)}\n`)

  console.log(
    `Añadido ${id} a scripts/seed.tsv.\n` +
      'Mueve la línea a su bloque de zona (el test lo exige) y ejecuta: npm run catalog',
  )
}

if (process.argv[1]?.endsWith('add-product.ts')) {
  await main()
}
