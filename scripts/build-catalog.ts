import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Product, Unit, Zone } from '../src/lib/types'
import { fetchFroizProduct, froizImageUrl, froizProductUrl } from './froiz'

const SEED = new URL('./seed.tsv', import.meta.url)
const OUT_JSON = new URL('../src/products.json', import.meta.url)
const OUT_IMG = new URL('../public/img/', import.meta.url)

interface SeedRow {
  id: number
  zone: Zone
  target: number
  unit: Unit
  name: string
  name_en: string
}

function readSeed(): SeedRow[] {
  const lines = readFileSync(SEED, 'utf8').trim().split('\n').slice(1)
  return lines.map((line) => {
    const [id, zone, target, unit, name, name_en] = line.split('\t')
    return {
      id: Number(id),
      zone: zone as Zone,
      target: Number(target),
      unit: unit as Unit,
      name,
      name_en,
    }
  })
}

/**
 * La unidad de la semilla manda sobre la API. La API devuelve
 * `measurement_unit: "Unidad"` también para los packs, así que fiarse de ella
 * haría contar Estrella Galicia por botellas en vez de por packs de 12.
 * Aquí sólo avisamos de las discrepancias que merece la pena mirar.
 */
function warnUnitMismatch(row: SeedRow, measurementUnit: string, fractional: boolean): void {
  if (fractional && row.unit !== 'kg') {
    console.warn(
      `  ! ${row.id} ${row.name}: Froiz lo vende al peso pero la semilla dice "${row.unit}"`,
    )
  }
  if (!fractional && row.unit === 'kg') {
    console.warn(
      `  ! ${row.id} ${row.name}: la semilla dice "kg" pero Froiz lo vende por ${measurementUnit}`,
    )
  }
}

async function buildOne(row: SeedRow): Promise<Product> {
  const froiz = await fetchFroizProduct(row.id)
  warnUnitMismatch(row, froiz.measurement_unit, froiz.fractional)

  const imageRes = await fetch(froizImageUrl(froiz))
  if (!imageRes.ok) {
    throw new Error(`imagen: HTTP ${imageRes.status}`)
  }
  const bytes = new Uint8Array(await imageRes.arrayBuffer())
  writeFileSync(new URL(`./${row.id}.jpg`, OUT_IMG), bytes)
  console.log(`  ok ${row.id} ${row.name} (${bytes.length} b)`)

  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en,
    froiz_name: froiz.name,
    froiz_url: froizProductUrl(froiz),
    image: `/img/${row.id}.jpg`,
    target: row.target,
    unit: row.unit,
    location: row.zone,
  }
}

async function main(): Promise<void> {
  const seed = readSeed()
  mkdirSync(OUT_IMG, { recursive: true })

  const products: Product[] = []
  const failures: string[] = []

  // Se recorren todos aunque alguno falle: los productos se descatalogan en
  // Froiz sin avisar, y un run tiene que decir TODO lo que está roto, no sólo
  // el primero. Si hay fallos no se escribe products.json: un catálogo corto
  // en silencio es peor que ninguno.
  for (const row of seed) {
    try {
      products.push(await buildOne(row))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.error(`  FALLO ${row.id} ${row.name}: ${reason}`)
      failures.push(`${row.id} ${row.name} — ${reason}`)
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} productos han fallado:`)
    for (const failure of failures) console.error(`  - ${failure}`)
    console.error('\nNo se ha escrito src/products.json. Arregla scripts/seed.tsv y reintenta.')
    console.error('Un 404 casi siempre significa que Froiz descatalogó el producto:')
    console.error('busca recambio con https://servicios.froiz.com/api/products?term=<texto>')
    process.exitCode = 1
    return
  }

  writeFileSync(OUT_JSON, `${JSON.stringify(products, null, 2)}\n`)
  console.log(`\n${products.length} productos escritos en src/products.json`)
}

await main()
