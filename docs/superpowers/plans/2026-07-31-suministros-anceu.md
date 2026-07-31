# Suministros Anceu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Webapp donde una persona del equipo cuenta el stock de suministros producto por producto y, al acabar, envía a `hello@anceu.com` un correo con lo que hay, lo que debería haber y lo que falta comprar.

**Architecture:** Un único Worker de Cloudflare sirve un SPA de React (estáticos vía `assets`) y atiende `POST /api/send`, que construye el correo y lo envía por la API de Resend. Sin base de datos: el catálogo es un JSON en el repo y los conteos viven en `localStorage` durante la sesión. Toda la lógica real está en `src/lib/` (funciones puras testeables sin navegador); componentes y Worker son capas finas encima.

**Tech Stack:** React 19, Vite 8, TypeScript, `@cloudflare/vite-plugin`, Wrangler 4, Vitest 4, Resend HTTP API.

**Spec:** [`docs/superpowers/specs/2026-07-31-suministros-anceu-design.md`](../specs/2026-07-31-suministros-anceu-design.md)

## Global Constraints

- **Gestor de paquetes: `npm`.** El plugin de Vite de Cloudflare y Wrangler están probados contra npm; bun da problemas con `wrangler dev`. Todos los comandos del plan usan `npm`.
- **`compatibility_date` de Wrangler: `"2026-07-31"`.**
- **El destinatario del correo está fijo en el código del Worker: `hello@anceu.com`.** Nunca llega desde el cliente. Es un endpoint abierto en internet; un destinatario parametrizable sería un relay de spam firmado con el dominio de Anceu.
- **Remitente: `Suministros Anceu <no-reply@send.anceu.com>`.**
- **`RESEND_API_KEY` es un secreto del Worker.** Nunca en el repo, nunca en el bundle del cliente, nunca en un `import.meta.env` del SPA.
- **Fechas y horas en `Europe/Madrid`**, calculadas en el Worker con `Intl.DateTimeFormat`. Los Workers corren en UTC; un conteo a las 00:30 saldría fechado el día anterior y esa fecha va en el asunto.
- **El correo va siempre en inglés**, independientemente del idioma de la interfaz. Lo procesa una IA.
- **La interfaz es bilingüe ES/EN, español por defecto**, elección guardada en `localStorage`.
- **`falta = max(0, objetivo − hay)`.** El clamp es obligatorio: un exceso de stock no genera línea de compra negativa.
- **Un producto no contado no es un cero.** No aparece en `TO BUY` ni en `FULL INVENTORY`, sólo en `NOT COUNTED`.
- **46 productos** en 5 zonas, en este orden: `cocina`, `limpieza`, `comida`, `bebidas`, `cafeteria`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/types.ts` | Tipos compartidos entre SPA, Worker y scripts. Sin lógica. |
| `src/lib/shortfall.ts` | Cruza catálogo + conteos → `Report`. La única aritmética del proyecto. |
| `src/lib/email.ts` | `Report` → asunto y cuerpo del correo. Formato fijo, sin HTML. |
| `src/lib/i18n.ts` | Diccionario ES/EN y selección de idioma. |
| `src/lib/storage.ts` | Lectura/escritura de la sesión de conteo en `localStorage`. |
| `src/products.json` | Catálogo generado. No se edita a mano. |
| `src/App.tsx` | Máquina de estados de pantallas. Sin lógica de negocio. |
| `src/screens/Start.tsx` | Pantalla inicial: nombre, idioma, empezar. |
| `src/screens/Count.tsx` | Recorrido producto por producto. |
| `src/screens/Review.tsx` | Revisión final y envío. |
| `src/screens/Sent.tsx` | Confirmación. |
| `src/components/ProductCard.tsx` | Una card: foto, nombres, objetivo, input. |
| `worker/index.ts` | Enrutado del Worker y llamada a Resend. |
| `worker/validate.ts` | Validación del cuerpo de `POST /api/send`. Función pura. |
| `scripts/seed.tsv` | Datos humanos del catálogo: id, zona, objetivo, unidad, nombres. |
| `scripts/froiz.ts` | Cliente de la API pública de Froiz. |
| `scripts/build-catalog.ts` | `seed.tsv` + API Froiz → `src/products.json` + `public/img/`. |
| `scripts/add-product.ts` | Añadir un producto desde una URL de Froiz. |

`shortfall.ts` y `email.ts` están fuera de los componentes porque son la única lógica real y tienen que testearse sin navegador. `validate.ts` está separado de `worker/index.ts` por lo mismo: se testea sin arrancar un Worker.

---

## Task 1: Scaffold desplegable

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `wrangler.jsonc`, `.gitignore`, `index.html`, `src/main.tsx`, `src/App.tsx`, `worker/index.ts`
- Test: `worker/index.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `worker/index.ts` exporta `default { fetch }` con la firma `(request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response`. El tipo `Env` se define aquí y las tareas posteriores lo amplían.

- [ ] **Step 1: Crear el proyecto e instalar dependencias**

```bash
cd ~/src/suministros-anceu
npm init -y
npm install react@^19 react-dom@^19
npm install -D vite@^8 @vitejs/plugin-react @cloudflare/vite-plugin wrangler@^4 \
  typescript @types/react @types/react-dom vitest@^4
```

- [ ] **Step 2: Escribir `package.json` (sobrescribir el generado)**

```json
{
  "name": "suministros-anceu",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "deploy": "vite build && wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Conservar los bloques `dependencies` y `devDependencies` que escribió `npm install`.

- [ ] **Step 3: Escribir `.gitignore`**

```
node_modules
dist
.wrangler
.dev.vars*
```

`.wrangler` y `.dev.vars*` son obligatorios: el primero es caché de build, el segundo puede contener la API key en local.

- [ ] **Step 4: Escribir `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "worker", "scripts", "worker-configuration.d.ts"]
}
```

`resolveJsonModule` es necesario para `import products from './products.json'`.
`worker-configuration.d.ts` se genera en el paso siguiente y declara los tipos globales
del runtime de Workers (`ExportedHandler`, `ExecutionContext`); sin él, `tsc` no compila
`worker/index.ts`.

- [ ] **Step 5: Escribir `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare()],
})
```

- [ ] **Step 6: Escribir `wrangler.jsonc`**

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "suministros-anceu",
  "compatibility_date": "2026-07-31",
  "main": "./worker/index.ts",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  }
}
```

`not_found_handling: "single-page-application"` hace que cualquier ruta que no sea un asset sirva `index.html`. `run_worker_first: ["/api/*"]` enruta explícitamente al Worker en vez de depender de la cabecera `Sec-Fetch-Mode`. Con el plugin de Vite **no se pone `directory`**: apunta solo al build del cliente.

- [ ] **Step 7: Generar los tipos del runtime de Workers**

```bash
npx wrangler types
```

Genera `worker-configuration.d.ts` a partir de `wrangler.jsonc`. Sin este archivo,
`ExportedHandler` y `ExecutionContext` no existen y `npm run build` falla. **Se commitea**
(no va a `.gitignore`) para que un clon limpio compile sin ejecutar wrangler; hay que
regenerarlo cada vez que cambien los bindings de `wrangler.jsonc`.

- [ ] **Step 8: Escribir `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Suministros Anceu</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Escribir `src/main.tsx` y `src/App.tsx`**

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx`:

```tsx
export function App() {
  return <h1>Suministros Anceu</h1>
}
```

- [ ] **Step 10: Escribir el test que falla**

`worker/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import worker, { type Env } from './index'

const env = {} as Env
const ctx = {} as ExecutionContext

describe('worker routing', () => {
  it('responds to /api/ping', async () => {
    const res = await worker.fetch(new Request('https://x/api/ping'), env, ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('404s unknown api routes', async () => {
    const res = await worker.fetch(new Request('https://x/api/nope'), env, ctx)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 11: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 12: Escribir `worker/index.ts`**

```ts
export interface Env {
  RESEND_API_KEY: string
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/ping') {
      return Response.json({ ok: true })
    }

    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
```

- [ ] **Step 13: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 2 tests.

- [ ] **Step 14: Verificar que el dev server arranca**

Run: `npm run dev`
Expected: Vite arranca. `curl http://localhost:5173/api/ping` devuelve `{"ok":true}`, y `http://localhost:5173/` muestra el `<h1>`. Parar con Ctrl-C.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React SPA sobre Cloudflare Worker"
```

---

## Task 2: Tipos y cálculo del informe

**Files:**
- Create: `src/lib/types.ts`, `src/lib/shortfall.ts`
- Test: `src/lib/shortfall.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `Unit = 'ud' | 'pack' | 'bolsa' | 'kg'`
  - `Zone = 'cocina' | 'limpieza' | 'comida' | 'bebidas' | 'cafeteria'`
  - `Product { id: number; name: string; name_en: string; froiz_name: string; froiz_url: string; image: string; target: number; unit: Unit; location: Zone }`
  - `CountEntry { id: number; amount: number | null }` — `null` significa **no contado**.
  - `Line { product: Product; have: number; buy: number }`
  - `Report { toBuy: Line[]; counted: Line[]; notCounted: Product[] }`
  - `buildReport(products: Product[], counts: CountEntry[]): Report`
  - `ZONES: readonly Zone[]`

- [ ] **Step 1: Escribir `src/lib/types.ts`**

```ts
export type Unit = 'ud' | 'pack' | 'bolsa' | 'kg'

export type Zone = 'cocina' | 'limpieza' | 'comida' | 'bebidas' | 'cafeteria'

/** Orden de recorrido de la casa. No reordenar sin motivo: es el camino físico. */
export const ZONES: readonly Zone[] = ['cocina', 'limpieza', 'comida', 'bebidas', 'cafeteria']

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
```

- [ ] **Step 2: Escribir el test que falla**

`src/lib/shortfall.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildReport } from './shortfall'
import type { Product } from './types'

function product(id: number, target: number, name = `p${id}`): Product {
  return {
    id,
    name,
    name_en: name,
    froiz_name: name,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target,
    unit: 'ud',
    location: 'cocina',
  }
}

describe('buildReport', () => {
  it('calcula lo que falta cuando hay menos del objetivo', () => {
    const report = buildReport([product(1, 7)], [{ id: 1, amount: 4 }])
    expect(report.toBuy).toHaveLength(1)
    expect(report.toBuy[0].buy).toBe(3)
    expect(report.toBuy[0].have).toBe(4)
  })

  it('no genera linea de compra cuando hay justo el objetivo', () => {
    const report = buildReport([product(1, 3)], [{ id: 1, amount: 3 }])
    expect(report.toBuy).toHaveLength(0)
    expect(report.counted).toHaveLength(1)
    expect(report.counted[0].buy).toBe(0)
  })

  it('hace clamp a 0 con exceso de stock en vez de dar negativo', () => {
    // Estrella Galicia en el sheet real: objetivo 6, hay 12.
    const report = buildReport([product(1, 6)], [{ id: 1, amount: 12 }])
    expect(report.toBuy).toHaveLength(0)
    expect(report.counted[0].buy).toBe(0)
  })

  it('un producto no contado no cuenta como cero ni genera compra', () => {
    const report = buildReport([product(1, 5)], [{ id: 1, amount: null }])
    expect(report.toBuy).toHaveLength(0)
    expect(report.counted).toHaveLength(0)
    expect(report.notCounted).toEqual([product(1, 5)])
  })

  it('un producto ausente de los conteos se trata como no contado', () => {
    const report = buildReport([product(1, 5)], [])
    expect(report.notCounted).toHaveLength(1)
    expect(report.counted).toHaveLength(0)
  })

  it('counted y notCounted suman el catalogo y no se solapan', () => {
    const products = [product(1, 3), product(2, 3), product(3, 3)]
    const report = buildReport(products, [
      { id: 1, amount: 0 },
      { id: 2, amount: null },
    ])
    expect(report.counted).toHaveLength(1)
    expect(report.notCounted).toHaveLength(2)
    expect(report.counted.length + report.notCounted.length).toBe(products.length)
  })

  it('contado a cero si genera compra por el objetivo entero', () => {
    const report = buildReport([product(1, 3)], [{ id: 1, amount: 0 }])
    expect(report.toBuy[0].buy).toBe(3)
  })

  it('mantiene el orden del catalogo', () => {
    const products = [product(10, 1), product(20, 1), product(30, 1)]
    const report = buildReport(products, [
      { id: 30, amount: 0 },
      { id: 10, amount: 0 },
      { id: 20, amount: 0 },
    ])
    expect(report.toBuy.map((l) => l.product.id)).toEqual([10, 20, 30])
  })

  it('ignora conteos de ids que no estan en el catalogo', () => {
    const report = buildReport([product(1, 3)], [
      { id: 1, amount: 1 },
      { id: 999, amount: 1 },
    ])
    expect(report.counted).toHaveLength(1)
    expect(report.toBuy).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './shortfall'`.

- [ ] **Step 4: Escribir `src/lib/shortfall.ts`**

```ts
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
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 9 tests nuevos + los 2 del Worker.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: tipos del catalogo y calculo del informe de faltantes"
```

---

## Task 3: Semilla del catálogo

**Files:**
- Create: `scripts/seed.tsv`
- Test: `scripts/seed.test.ts`

**Interfaces:**
- Consumes: `Unit`, `Zone`, `ZONES` de `src/lib/types.ts`.
- Produces: `scripts/seed.tsv` con 46 filas y cabecera. Columnas separadas por tabulador: `id`, `zone`, `target`, `unit`, `name`, `name_en`.

**Contexto:** este archivo es el único sitio con juicio humano (traducciones, nombres limpios, unidades). Todo lo demás del catálogo lo rellena la API de Froiz en la Task 4. Los datos vienen de la pestaña `Coliving groceries` del Google Sheet a 2026-07-31, con cuatro correcciones deliberadas documentadas al final de esta tarea.

- [ ] **Step 1: Escribir `scripts/seed.tsv`**

Separador: **un tabulador** entre columnas. Sin comillas.

```tsv
id	zone	target	unit	name	name_en
2565	cocina	3	ud	Papel higiénico	Toilet paper
23293	cocina	7	ud	Papel de horno	Oven paper
23646	cocina	6	ud	Papel de aluminio	Aluminium foil
5406	cocina	4	ud	Película de plástico	Cling film
38762	cocina	7	ud	Papel de cocina	Kitchen paper
2527	cocina	6	ud	Servilletas	Napkins
57172	cocina	5	ud	Bolsas de basura 100 L	Bin bags 100 L
45113	cocina	4	ud	Bolsas de basura 30 L	Bin bags 30 L
79223	cocina	4	ud	Bayetas	Cleaning cloths
27895	cocina	4	ud	Estropajos	Scouring pads
21716	cocina	4	ud	Nanita	Cleaning pad (delicate surfaces)
56093	limpieza	4	ud	Detergente Marsella	Marsella detergent
48857	limpieza	4	ud	Suavizante Vernel Maldivas	Fabric softener (Vernel Maldivas)
20124	limpieza	5	ud	Insecticida	Insecticide
22699	limpieza	4	ud	Ambientador spray	Air freshener spray
23085	limpieza	4	ud	Ambientador de palos	Reed diffuser
38910	limpieza	4	ud	Fregasuelos	Floor cleaner
55588	limpieza	4	ud	Bolas para limpieza de wáter	Toilet rim blocks
2283	limpieza	3	ud	Desengrasante Zorka	Degreaser (Zorka)
4976	limpieza	5	ud	Lejía con detergente	Bleach with detergent
15086	limpieza	3	ud	Desatascador de tuberías líquido	Liquid drain unblocker
40240	limpieza	2	ud	Oxígeno activo	Oxygen stain remover
51629	limpieza	2	ud	Blanqueador percarbonato	Percarbonate whitener
45365	comida	3	ud	Helados mini twins	Mini ice cream sandwiches (twins)
45372	comida	3	ud	Helado sándwich de nata	Ice cream sandwiches (cream)
68507	comida	3	ud	Helado sándwich tipo Oreo	Ice cream sandwiches (cookies and cream)
5014	comida	2	ud	Sal gruesa	Coarse salt
5034	comida	1	ud	Sal fina	Fine iodised salt
52790	comida	2	ud	Orégano	Oregano
4598	comida	2	ud	Mantequilla	Butter
46677	comida	2	ud	Azúcar	White sugar
58871	comida	4	ud	Mermelada de fresa	Strawberry jam
7292	bebidas	5	pack	Shandy (pack de 6)	Shandy, lemon (6-pack)
9753	bebidas	5	pack	Coca-Cola (pack de 12 latas)	Coca-Cola (12-can pack)
9106	bebidas	2	pack	Coca-Cola Zero (pack de 12 latas)	Coca-Cola Zero (12-can pack)
7670	bebidas	6	pack	Estrella Galicia (pack de 12 botellas)	Estrella Galicia (12-bottle pack)
37283	bebidas	2	pack	Estrella Galicia 0,0 (pack de 6 botellas)	Alcohol-free beer 0.0 (6-bottle pack)
51190	cafeteria	12	ud	Bebida de avena	Oat drink
10360	cafeteria	5	ud	Café en grano natural	Coffee beans
41183	cafeteria	4	ud	Café molido descafeinado	Decaf ground coffee
50152	cafeteria	2	ud	Té rojo	Red tea
50154	cafeteria	2	ud	Té verde	Green tea
1827	cafeteria	2	ud	Manzanilla	Chamomile
1924	cafeteria	2	ud	Menta poleo	Peppermint tea
44312	cafeteria	5	bolsa	Hielo	Ice
15592	cafeteria	12	ud	Leche semidesnatada sin lactosa	Lactose-free semi-skimmed milk
```

- [ ] **Step 2: Escribir el test que falla**

`scripts/seed.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ZONES, type Unit } from '../src/lib/types'

const UNITS: Unit[] = ['ud', 'pack', 'bolsa', 'kg']

const rows = readFileSync(new URL('./seed.tsv', import.meta.url), 'utf8')
  .trim()
  .split('\n')

const header = rows[0].split('\t')
const data = rows.slice(1).map((line) => {
  const [id, zone, target, unit, name, name_en] = line.split('\t')
  return { id, zone, target, unit, name, name_en }
})

describe('seed.tsv', () => {
  it('tiene la cabecera esperada', () => {
    expect(header).toEqual(['id', 'zone', 'target', 'unit', 'name', 'name_en'])
  })

  it('tiene 46 productos', () => {
    expect(data).toHaveLength(46)
  })

  it('no repite ids', () => {
    const ids = data.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todas las filas estan completas', () => {
    for (const row of data) {
      for (const [key, value] of Object.entries(row)) {
        expect(value, `${row.id} ${key}`).toBeTruthy()
      }
    }
  })

  it('usa solo zonas y unidades conocidas', () => {
    for (const row of data) {
      expect(ZONES, row.id).toContain(row.zone)
      expect(UNITS, row.id).toContain(row.unit)
    }
  })

  it('los objetivos son enteros positivos', () => {
    for (const row of data) {
      const target = Number(row.target)
      expect(Number.isInteger(target), row.id).toBe(true)
      expect(target, row.id).toBeGreaterThan(0)
    }
  })

  it('agrupa las zonas en el orden de recorrido de la casa', () => {
    const seen: string[] = []
    for (const row of data) {
      if (seen[seen.length - 1] !== row.zone) seen.push(row.zone)
    }
    // Cada zona aparece en un unico bloque contiguo, en el orden de ZONES.
    expect(seen).toEqual([...ZONES])
  })

  it('no deja parentesis de formato del sheet en los nombres', () => {
    for (const row of data) {
      expect(row.name, row.id).not.toMatch(/\(\s*(unit|bag)\s*\)/i)
      expect(row.name, row.id).not.toContain(' / ')
    }
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 8 tests nuevos. Si falla `agrupa las zonas`, hay una fila fuera de su bloque: moverla, no cambiar `ZONES`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: semilla del catalogo con los 46 productos del coliving"
```

**Correcciones deliberadas sobre el Google Sheet.** Están aquí y no en el sheet porque el sheet es la fuente vieja; a partir de ahora la fuente es este archivo:

1. **`Leche semidesnatada` (id 408) eliminada.** La casa se queda sólo con avena y sin lactosa.
2. **`leche semi sin lactosa` (id 15592) completada.** En el sheet no tenía link ni objetivo. Objetivo 12.
3. **Estrella Galicia (id 7670): el sheet dice "pack de 6 botellas", el producto de Froiz es `pack-12x25-cl`, o sea 12.** Con objetivo 6 packs, la etiqueta equivocada significaba el doble de cerveza de la que se cree que se pide. Corregido a 12 botellas. **El objetivo sigue siendo 6 packs, sin tocar** — cambiarlo es decisión de Agustín, no de esta implementación.
4. **`Bolsas basura` (id 45113) renombrada a `Bolsas de basura 30 L`** (el slug de Froiz dice `30-l`), porque coexiste con las de 100 L y en una card sin contexto eran indistinguibles.

---

## Task 4: Generar el catálogo desde la API de Froiz

**Files:**
- Create: `scripts/froiz.ts`, `scripts/build-catalog.ts`
- Create (generado): `src/products.json`, `public/img/*.jpg`
- Test: `scripts/froiz.test.ts`

**Interfaces:**
- Consumes: `scripts/seed.tsv`; `Product`, `Unit`, `Zone` de `src/lib/types.ts`.
- Produces:
  - `FroizProduct { id: number; name: string; slug: string; image: string; measurement_unit: string; per_unit: boolean; fractional: boolean }`
  - `fetchFroizProduct(id: number): Promise<FroizProduct>`
  - `froizProductUrl(p: FroizProduct): string`
  - `froizImageUrl(p: FroizProduct): string`
  - `src/products.json`: array de `Product`, en el orden de `seed.tsv`.

**Contexto:** la API de Froiz es **pública, sin autenticación**: `GET https://servicios.froiz.com/api/products/{id}`. Devuelve, entre otras cosas, `name` (nombre canónico), `slug`, `measurement_unit`, `per_unit`, `fractional` y `image` (ruta de Cloudflare Images con firma).

- [ ] **Step 1: Instalar `tsx` y añadir el script del catálogo**

```bash
npm install -D tsx
```

Añadir a `scripts` en `package.json`:

```json
"catalog": "tsx scripts/build-catalog.ts"
```

- [ ] **Step 2: Escribir el test que falla**

`scripts/froiz.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { froizImageUrl, froizProductUrl, type FroizProduct } from './froiz'

const sample: FroizProduct = {
  id: 21716,
  name: 'Almohadilla limpieza Froiz superficies delicadas 2 u',
  slug: '21716-almohadilla-limpieza-froiz-superficies-delicadas-2-u',
  image: '/laxGYDNZyT04iZVpzPzryw/69e1d84f/desktop?exp=1785528182&sig=abc',
  measurement_unit: 'Unidad',
  per_unit: false,
  fractional: false,
}

describe('froizProductUrl', () => {
  it('construye la url de tienda desde el slug', () => {
    expect(froizProductUrl(sample)).toBe(
      'https://supermercado.froiz.com/product/21716-almohadilla-limpieza-froiz-superficies-delicadas-2-u',
    )
  })
})

describe('froizImageUrl', () => {
  it('usa la ruta firmada que devuelve la api, sin hardcodear el hash de cuenta', () => {
    expect(froizImageUrl(sample)).toBe(
      'https://imagedelivery.net/laxGYDNZyT04iZVpzPzryw/69e1d84f/desktop?exp=1785528182&sig=abc',
    )
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './froiz'`.

- [ ] **Step 4: Escribir `scripts/froiz.ts`**

```ts
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
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Escribir `scripts/build-catalog.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fetchFroizProduct, froizImageUrl, froizProductUrl } from './froiz'
import type { Product, Unit, Zone } from '../src/lib/types'

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
    console.warn(`  ! ${row.id} ${row.name}: Froiz lo vende al peso pero la semilla dice "${row.unit}"`)
  }
  if (!fractional && row.unit === 'kg') {
    console.warn(`  ! ${row.id} ${row.name}: la semilla dice "kg" pero Froiz lo vende por ${measurementUnit}`)
  }
}

async function main(): Promise<void> {
  const seed = readSeed()
  mkdirSync(OUT_IMG, { recursive: true })

  const products: Product[] = []
  for (const row of seed) {
    const froiz = await fetchFroizProduct(row.id)
    warnUnitMismatch(row, froiz.measurement_unit, froiz.fractional)

    const imageRes = await fetch(froizImageUrl(froiz))
    if (!imageRes.ok) {
      throw new Error(`Imagen de ${row.id}: HTTP ${imageRes.status}`)
    }
    const bytes = new Uint8Array(await imageRes.arrayBuffer())
    writeFileSync(new URL(`./${row.id}.jpg`, OUT_IMG), bytes)

    products.push({
      id: row.id,
      name: row.name,
      name_en: row.name_en,
      froiz_name: froiz.name,
      froiz_url: froizProductUrl(froiz),
      image: `/img/${row.id}.jpg`,
      target: row.target,
      unit: row.unit,
      location: row.zone,
    })
    console.log(`  ok ${row.id} ${row.name} (${bytes.length} b)`)
  }

  writeFileSync(OUT_JSON, `${JSON.stringify(products, null, 2)}\n`)
  console.log(`\n${products.length} productos escritos en src/products.json`)
}

await main()
```

- [ ] **Step 7: Ejecutar el generador**

Run: `npm run catalog`
Expected: 46 líneas `ok`, y al final `46 productos escritos en src/products.json`. Las 46 imágenes en `public/img/`. Si aparece algún `!`, léelo y decide: la semilla manda, pero un aviso puede señalar un producto descatalogado o cambiado.

- [ ] **Step 8: Verificar el resultado**

```bash
ls public/img | wc -l    # 46
du -sh public/img        # esperado: unos cientos de KB
```
Expected: `46` imágenes. La integridad del JSON la comprueba el test del paso siguiente.

- [ ] **Step 9: Escribir el test de integridad del catálogo generado**

`src/products.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import products from './products.json'
import { ZONES, type Product } from './lib/types'

const catalog = products as Product[]

describe('products.json', () => {
  it('tiene 46 productos sin ids repetidos', () => {
    expect(catalog).toHaveLength(46)
    expect(new Set(catalog.map((p) => p.id)).size).toBe(46)
  })

  it('todos los campos estan rellenos', () => {
    for (const p of catalog) {
      expect(p.name, String(p.id)).toBeTruthy()
      expect(p.name_en, String(p.id)).toBeTruthy()
      expect(p.froiz_name, String(p.id)).toBeTruthy()
      expect(p.froiz_url, String(p.id)).toMatch(/^https:\/\/supermercado\.froiz\.com\/product\//)
      expect(p.image, String(p.id)).toBe(`/img/${p.id}.jpg`)
      expect(p.target, String(p.id)).toBeGreaterThan(0)
      expect(ZONES, String(p.id)).toContain(p.location)
    }
  })

  it('las urls no arrastran el # que traia el sheet', () => {
    for (const p of catalog) {
      expect(p.froiz_url, String(p.id)).not.toContain('#')
    }
  })
})
```

- [ ] **Step 10: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: generar catalogo y fotos desde la api publica de Froiz"
```

---

## Task 5: Idiomas

**Files:**
- Create: `src/lib/i18n.ts`
- Test: `src/lib/i18n.test.ts`

**Interfaces:**
- Consumes: `Product`, `Unit` de `src/lib/types.ts`.
- Produces:
  - `Lang = 'es' | 'en'`
  - `DEFAULT_LANG: Lang` (= `'es'`)
  - `t(lang: Lang): Strings` — objeto con todos los textos de la interfaz.
  - `productName(product: Product, lang: Lang): string`
  - `unitLabel(unit: Unit, lang: Lang): string`
  - `loadLang(): Lang` / `saveLang(lang: Lang): void`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_LANG, productName, t, unitLabel } from './i18n'
import type { Product } from './types'

const p: Product = {
  id: 1,
  name: 'Papel de cocina',
  name_en: 'Kitchen paper',
  froiz_name: 'Papel cocina Froiz maxi',
  froiz_url: 'https://supermercado.froiz.com/product/1-x',
  image: '/img/1.jpg',
  target: 7,
  unit: 'ud',
  location: 'cocina',
}

describe('i18n', () => {
  it('el idioma por defecto es español', () => {
    expect(DEFAULT_LANG).toBe('es')
  })

  it('devuelve el nombre en el idioma pedido', () => {
    expect(productName(p, 'es')).toBe('Papel de cocina')
    expect(productName(p, 'en')).toBe('Kitchen paper')
  })

  it('cae al español si falta la traducción', () => {
    expect(productName({ ...p, name_en: '' }, 'en')).toBe('Papel de cocina')
  })

  it('traduce las unidades', () => {
    expect(unitLabel('pack', 'es')).toBe('packs')
    expect(unitLabel('pack', 'en')).toBe('packs')
    expect(unitLabel('bolsa', 'es')).toBe('bolsas')
    expect(unitLabel('bolsa', 'en')).toBe('bags')
  })

  it('define las mismas claves en los dos idiomas', () => {
    expect(Object.keys(t('es')).sort()).toEqual(Object.keys(t('en')).sort())
  })

  it('no deja ningun texto vacio', () => {
    for (const lang of ['es', 'en'] as const) {
      for (const [key, value] of Object.entries(t(lang))) {
        expect(value, `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './i18n'`.

- [ ] **Step 3: Escribir `src/lib/i18n.ts`**

```ts
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
  shouldBe: string
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
  shouldBe: 'Debería haber',
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
  shouldBe: 'Should be',
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
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: textos ES/EN y etiquetas de unidad"
```

---

## Task 6: Construcción del correo

**Files:**
- Create: `src/lib/email.ts`
- Test: `src/lib/email.test.ts`

**Interfaces:**
- Consumes: `buildReport` de `src/lib/shortfall.ts`; `CountEntry`, `Product`, `Report` de `src/lib/types.ts`.
- Produces:
  - `formatMadrid(now: Date): { date: string; time: string }`
  - `buildEmail(products: Product[], counts: CountEntry[], counterName: string, now: Date): { subject: string; text: string }`

**Formato de referencia** (el que consume la IA que monta el pedido):

```
Subject: [Anceu] Supplies — 7 to buy (2026-07-31)

Counted by: Bartek — 2026-07-31 18:42

TO BUY (7)
Papel de cocina                have 4    should be 7    buy 3 ud      https://supermercado.froiz.com/product/38762-...
...

FULL INVENTORY (44 counted)
Papel higiénico                have 3    should be 3    OK
...

NOT COUNTED (2)
Estropajos
Bolsas de basura 100 L
```

- [ ] **Step 1: Escribir el test que falla**

`src/lib/email.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildEmail, formatMadrid } from './email'
import type { CountEntry, Product } from './types'

function product(id: number, name: string, target: number): Product {
  return {
    id,
    name,
    name_en: name,
    froiz_name: `Froiz ${name}`,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target,
    unit: 'ud',
    location: 'cocina',
  }
}

const products = [
  product(1, 'Papel de cocina', 7),
  product(2, 'Papel higiénico', 3),
  product(3, 'Estropajos', 4),
]

const counts: CountEntry[] = [
  { id: 1, amount: 4 },
  { id: 2, amount: 3 },
  { id: 3, amount: null },
]

const now = new Date('2026-07-31T16:42:00Z') // 18:42 en Madrid (CEST, UTC+2)

describe('formatMadrid', () => {
  it('convierte a hora de Madrid, no a UTC', () => {
    expect(formatMadrid(now)).toEqual({ date: '2026-07-31', time: '18:42' })
  })

  it('no adelanta el dia con un conteo de madrugada', () => {
    // 23:30 UTC del 30 son las 01:30 del 31 en Madrid.
    expect(formatMadrid(new Date('2026-07-30T23:30:00Z')).date).toBe('2026-07-31')
  })
})

describe('buildEmail', () => {
  it('pone el numero de faltantes y la fecha en el asunto', () => {
    const { subject } = buildEmail(products, counts, 'Bartek', now)
    expect(subject).toBe('[Anceu] Supplies — 1 to buy (2026-07-31)')
  })

  it('cuenta solo los productos que faltan, no los contados', () => {
    // 3 productos: uno corto, uno al objetivo, uno sin contar -> 1 a comprar.
    const { subject } = buildEmail(products, counts, 'Bartek', now)
    expect(subject).toContain('1 to buy')
  })

  it('dice nothing to buy cuando no falta nada', () => {
    const full: CountEntry[] = [
      { id: 1, amount: 7 },
      { id: 2, amount: 3 },
      { id: 3, amount: 4 },
    ]
    const { subject } = buildEmail(products, full, 'Bartek', now)
    expect(subject).toBe('[Anceu] Supplies — nothing to buy (2026-07-31)')
  })

  it('incluye quien ha contado y la hora de Madrid', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    expect(text).toContain('Counted by: Bartek — 2026-07-31 18:42')
  })

  it('sin nombre pone (not given) y no falla', () => {
    const { text } = buildEmail(products, counts, '', now)
    expect(text).toContain('Counted by: (not given)')
  })

  it('recorta los espacios del nombre', () => {
    const { text } = buildEmail(products, counts, '  Bartek  ', now)
    expect(text).toContain('Counted by: Bartek —')
  })

  it('la seccion TO BUY lleva cantidad, unidad y url', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    const line = text.split('\n').find((l) => l.startsWith('Papel de cocina'))!
    expect(line).toContain('have 4')
    expect(line).toContain('should be 7')
    expect(line).toContain('buy 3 ud')
    expect(line).toContain('https://supermercado.froiz.com/product/1-x')
  })

  it('marca OK los productos que estan al objetivo', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    const inventory = text.slice(text.indexOf('FULL INVENTORY'))
    expect(inventory).toMatch(/Papel higiénico.*OK/)
  })

  it('lista los no contados y no los mete en TO BUY ni en FULL INVENTORY', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    const [, rest] = text.split('NOT COUNTED')
    expect(rest).toContain('Estropajos')

    const before = text.slice(0, text.indexOf('NOT COUNTED'))
    expect(before).not.toContain('Estropajos')
  })

  it('las cabeceras de seccion suman el catalogo', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    expect(text).toContain('TO BUY (1)')
    expect(text).toContain('FULL INVENTORY (2 counted)')
    expect(text).toContain('NOT COUNTED (1)')
  })

  it('omite NOT COUNTED cuando se ha contado todo', () => {
    const full: CountEntry[] = [
      { id: 1, amount: 1 },
      { id: 2, amount: 1 },
      { id: 3, amount: 1 },
    ]
    const { text } = buildEmail(products, full, 'Bartek', now)
    expect(text).not.toContain('NOT COUNTED')
  })

  it('dice explicitamente que no falta nada en vez de dejar la seccion vacia', () => {
    const full: CountEntry[] = [
      { id: 1, amount: 7 },
      { id: 2, amount: 3 },
      { id: 3, amount: 4 },
    ]
    const { text } = buildEmail(products, full, 'Bartek', now)
    expect(text).toContain('TO BUY (0)')
    expect(text).toContain('Nothing to buy.')
  })

  it('no lleva html', () => {
    const { text } = buildEmail(products, counts, 'Bartek', now)
    expect(text).not.toMatch(/<[a-z]/i)
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './email'`.

- [ ] **Step 3: Escribir `src/lib/email.ts`**

```ts
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
    lines.push(
      pad(product.name, NAME_WIDTH) +
        pad(`have ${have}`, COL_WIDTH) +
        pad(`should be ${product.target}`, COL_WIDTH) +
        (buy === 0 ? 'OK' : ''),
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
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 15 tests nuevos.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: construir el correo en texto plano para la IA del pedido"
```

---

## Task 7: Endpoint de envío

**Files:**
- Create: `worker/validate.ts`
- Modify: `worker/index.ts`
- Test: `worker/validate.test.ts`, `worker/index.test.ts`

**Interfaces:**
- Consumes: `buildEmail` de `src/lib/email.ts`; `CountEntry`, `SendRequest` de `src/lib/types.ts`; `products.json`.
- Produces:
  - `parseSendRequest(body: unknown, validIds: Set<number>): SendRequest` — lanza `ValidationError` con mensaje si el cuerpo no encaja.
  - `class ValidationError extends Error`
  - `POST /api/send` → `200 {ok:true}` | `400 {error}` | `502 {error}`

- [ ] **Step 1: Escribir el test de validación que falla**

`worker/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ValidationError, parseSendRequest } from './validate'

const ids = new Set([1, 2, 3])

describe('parseSendRequest', () => {
  it('acepta un cuerpo valido', () => {
    const parsed = parseSendRequest(
      { counter_name: 'Bartek', counts: [{ id: 1, amount: 4 }, { id: 2, amount: null }] },
      ids,
    )
    expect(parsed.counter_name).toBe('Bartek')
    expect(parsed.counts).toHaveLength(2)
  })

  it('acepta counter_name ausente y lo deja vacio', () => {
    const parsed = parseSendRequest({ counts: [{ id: 1, amount: 0 }] }, ids)
    expect(parsed.counter_name).toBe('')
  })

  it('rechaza un cuerpo que no es objeto', () => {
    expect(() => parseSendRequest('nope', ids)).toThrow(ValidationError)
    expect(() => parseSendRequest(null, ids)).toThrow(ValidationError)
  })

  it('rechaza counts que no es array', () => {
    expect(() => parseSendRequest({ counts: 'x' }, ids)).toThrow(ValidationError)
  })

  it('rechaza counts vacio', () => {
    expect(() => parseSendRequest({ counts: [] }, ids)).toThrow(ValidationError)
  })

  it('rechaza ids que no estan en el catalogo', () => {
    expect(() => parseSendRequest({ counts: [{ id: 999, amount: 1 }] }, ids)).toThrow(
      /unknown product/i,
    )
  })

  it('rechaza ids repetidos', () => {
    expect(() =>
      parseSendRequest({ counts: [{ id: 1, amount: 1 }, { id: 1, amount: 2 }] }, ids),
    ).toThrow(/duplicate/i)
  })

  it('rechaza cantidades negativas', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: -1 }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza cantidades no enteras', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: 1.5 }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza cantidades absurdas', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: 100_000 }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza cantidades que no son numero ni null', () => {
    expect(() => parseSendRequest({ counts: [{ id: 1, amount: '4' }] }, ids)).toThrow(
      ValidationError,
    )
  })

  it('rechaza mas counts que productos del catalogo', () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ id: 1, amount: i }))
    expect(() => parseSendRequest({ counts: many }, ids)).toThrow(ValidationError)
  })

  it('recorta y limita la longitud del nombre', () => {
    const parsed = parseSendRequest(
      { counter_name: `  ${'a'.repeat(500)}  `, counts: [{ id: 1, amount: 1 }] },
      ids,
    )
    expect(parsed.counter_name.length).toBe(80)
  })

  it('rechaza counter_name que no es string', () => {
    expect(() => parseSendRequest({ counter_name: 5, counts: [{ id: 1, amount: 1 }] }, ids)).toThrow(
      ValidationError,
    )
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './validate'`.

- [ ] **Step 3: Escribir `worker/validate.ts`**

```ts
import type { CountEntry, SendRequest } from '../src/lib/types'

/** Tope defensivo: nadie tiene 10.000 rollos de papel. */
const MAX_AMOUNT = 10_000
const MAX_NAME = 80

export class ValidationError extends Error {}

function fail(message: string): never {
  throw new ValidationError(message)
}

/**
 * El endpoint está abierto en internet, así que no se confía en nada del
 * cliente: sólo ids del catálogo, cantidades enteras y acotadas, y un tope de
 * entradas. El destinatario del correo NO viaja en el cuerpo — está fijo en
 * `worker/index.ts`.
 */
export function parseSendRequest(body: unknown, validIds: Set<number>): SendRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    fail('body must be an object')
  }
  const raw = body as Record<string, unknown>

  const nameRaw = raw.counter_name ?? ''
  if (typeof nameRaw !== 'string') fail('counter_name must be a string')
  const counter_name = nameRaw.trim().slice(0, MAX_NAME)

  if (!Array.isArray(raw.counts)) fail('counts must be an array')
  if (raw.counts.length === 0) fail('counts must not be empty')
  if (raw.counts.length > validIds.size) fail('too many counts')

  const seen = new Set<number>()
  const counts: CountEntry[] = raw.counts.map((entry) => {
    if (typeof entry !== 'object' || entry === null) fail('each count must be an object')
    const { id, amount } = entry as Record<string, unknown>

    if (typeof id !== 'number' || !Number.isInteger(id)) fail('count id must be an integer')
    if (!validIds.has(id)) fail(`unknown product id ${id}`)
    if (seen.has(id)) fail(`duplicate product id ${id}`)
    seen.add(id)

    if (amount === null) return { id, amount: null }
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      fail(`amount for ${id} must be an integer or null`)
    }
    if (amount < 0 || amount > MAX_AMOUNT) fail(`amount for ${id} out of range`)

    return { id, amount }
  })

  return { counter_name, counts }
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 14 tests nuevos.

- [ ] **Step 5: Escribir el test del endpoint que falla**

Reemplazar `worker/index.test.ts` entero:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from './index'

const env: Env = { RESEND_API_KEY: 'test-key' }
const ctx = {} as ExecutionContext

function post(body: unknown): Request {
  return new Request('https://x/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = { counter_name: 'Bartek', counts: [{ id: 2565, amount: 1 }] }

afterEach(() => {
  vi.restoreAllMocks()
})

function mockResend(response: Response): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
}

describe('worker routing', () => {
  it('responds to /api/ping', async () => {
    const res = await worker.fetch(new Request('https://x/api/ping'), env, ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('404s unknown api routes', async () => {
    const res = await worker.fetch(new Request('https://x/api/nope'), env, ctx)
    expect(res.status).toBe(404)
  })

  it('405s GET on /api/send', async () => {
    const res = await worker.fetch(new Request('https://x/api/send'), env, ctx)
    expect(res.status).toBe(405)
  })
})

describe('POST /api/send', () => {
  it('envia el correo y devuelve ok', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    const res = await worker.fetch(post(validBody), env, ctx)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledOnce()
  })

  it('manda a hello@anceu.com y desde no-reply@send.anceu.com', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    await worker.fetch(post(validBody), env, ctx)

    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const payload = JSON.parse(init.body as string)
    expect(payload.to).toEqual(['hello@anceu.com'])
    expect(payload.from).toBe('Suministros Anceu <no-reply@send.anceu.com>')
    expect(payload.subject).toContain('[Anceu] Supplies')
    expect(payload.text).toContain('Counted by: Bartek')
    expect(payload.html).toBeUndefined()
  })

  it('ignora cualquier destinatario que venga del cliente', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    await worker.fetch(post({ ...validBody, to: 'attacker@example.com' }), env, ctx)

    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string).to).toEqual(['hello@anceu.com'])
  })

  it('usa la api key del entorno como bearer', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    await worker.fetch(post(validBody), env, ctx)

    const [, init] = spy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('400 con un cuerpo invalido, sin llamar a Resend', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    const res = await worker.fetch(post({ counts: [{ id: 999, amount: 1 }] }), env, ctx)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('unknown product') })
    expect(spy).not.toHaveBeenCalled()
  })

  it('400 con json roto', async () => {
    const res = await worker.fetch(
      new Request('https://x/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      }),
      env,
      ctx,
    )
    expect(res.status).toBe(400)
  })

  it('502 si Resend falla, y no dice por que al cliente', async () => {
    mockResend(new Response('rate limited', { status: 429 }))
    const res = await worker.fetch(post(validBody), env, ctx)

    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: string }
    expect(body.error).not.toContain('rate limited')
  })

  it('500 si falta la api key', async () => {
    const spy = mockResend(Response.json({ id: 'abc' }))
    const res = await worker.fetch(post(validBody), { RESEND_API_KEY: '' }, ctx)

    expect(res.status).toBe(500)
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — el Worker no tiene ruta `/api/send`.

- [ ] **Step 7: Reescribir `worker/index.ts`**

```ts
import products from '../src/products.json'
import { buildEmail } from '../src/lib/email'
import type { Product } from '../src/lib/types'
import { ValidationError, parseSendRequest } from './validate'

export interface Env {
  RESEND_API_KEY: string
}

const CATALOG = products as Product[]
const VALID_IDS = new Set(CATALOG.map((p) => p.id))

/**
 * Fijos a propósito. El endpoint está abierto en internet: si el destinatario
 * llegase del cliente, esto sería un relay de spam firmado con el dominio de
 * Anceu.
 */
const TO = 'hello@anceu.com'
const FROM = 'Suministros Anceu <no-reply@send.anceu.com>'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

async function handleSend(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY no configurada')
    return Response.json({ error: 'server misconfigured' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseSendRequest(body, VALID_IDS)
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    throw error
  }

  const { subject, text } = buildEmail(CATALOG, parsed.counts, parsed.counter_name, new Date())

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, text }),
  })

  if (!res.ok) {
    // El detalle va al log, no al cliente: puede filtrar la configuración de Resend.
    console.error(`Resend ${res.status}: ${await res.text()}`)
    return Response.json({ error: 'could not send email' }, { status: 502 })
  }

  return Response.json({ ok: true })
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/ping') {
      return Response.json({ ok: true })
    }

    if (url.pathname === '/api/send') {
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { allow: 'POST' } })
      }
      return handleSend(request, env)
    }

    return new Response(null, { status: 404 })
  },
} satisfies ExportedHandler<Env>
```

- [ ] **Step 8: Ejecutar los tests y verificar que pasan**

Run: `npm test`
Expected: PASS, todos.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: endpoint POST /api/send con validacion y envio por Resend"
```

---

## Task 8: Conteo en la interfaz

**Files:**
- Create: `src/lib/storage.ts`, `src/components/ProductCard.tsx`, `src/screens/Start.tsx`, `src/screens/Count.tsx`, `src/styles.css`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `Product`, `CountEntry`, `ZONES` de `src/lib/types.ts`; `t`, `productName`, `unitLabel`, `loadLang`, `saveLang`, `Lang` de `src/lib/i18n.ts`; `products.json`.
- Produces:
  - `Session { counterName: string; amounts: Record<number, number | null> }`
  - `loadSession(): Session | null` / `saveSession(s: Session): void` / `clearSession(): void`
  - `toCountEntries(session: Session): CountEntry[]`
  - `sortByZone(products: Product[]): Product[]`
  - `<Start>`, `<Count>`, `<ProductCard>`
  - `App` mantiene `screen: 'start' | 'count' | 'review' | 'sent'`. La Task 9 añade `review` y `sent`.

- [ ] **Step 1: Escribir el test de `storage` que falla**

`src/lib/storage.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, loadSession, saveSession, sortByZone, toCountEntries } from './storage'
import type { Product, Session } from './types'

beforeEach(() => {
  localStorage.clear()
})

const session: Session = {
  counterName: 'Bartek',
  amounts: { 1: 4, 2: null },
}

function product(id: number, location: Product['location']): Product {
  return {
    id,
    name: `p${id}`,
    name_en: `p${id}`,
    froiz_name: `p${id}`,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target: 1,
    unit: 'ud',
    location,
  }
}

describe('session storage', () => {
  it('guarda y recupera una sesion', () => {
    saveSession(session)
    expect(loadSession()).toEqual(session)
  })

  it('devuelve null si no hay nada guardado', () => {
    expect(loadSession()).toBeNull()
  })

  it('devuelve null y limpia si lo guardado esta corrupto', () => {
    localStorage.setItem('suministros-anceu:session', '{ not json')
    expect(loadSession()).toBeNull()
  })

  it('devuelve null si lo guardado no tiene la forma esperada', () => {
    localStorage.setItem('suministros-anceu:session', '{"counterName":"x"}')
    expect(loadSession()).toBeNull()
  })

  it('clearSession borra', () => {
    saveSession(session)
    clearSession()
    expect(loadSession()).toBeNull()
  })

  it('no propaga el fallo de localStorage lleno', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveSession(session)).not.toThrow()
  })
})

describe('toCountEntries', () => {
  it('convierte el mapa en el array que espera la api', () => {
    expect(toCountEntries(session)).toEqual([
      { id: 1, amount: 4 },
      { id: 2, amount: null },
    ])
  })
})

describe('sortByZone', () => {
  it('ordena por el recorrido de la casa, no por el orden de entrada', () => {
    const sorted = sortByZone([
      product(1, 'cafeteria'),
      product(2, 'cocina'),
      product(3, 'bebidas'),
    ])
    expect(sorted.map((p) => p.location)).toEqual(['cocina', 'bebidas', 'cafeteria'])
  })

  it('mantiene el orden original dentro de cada zona', () => {
    const sorted = sortByZone([product(9, 'cocina'), product(4, 'cocina')])
    expect(sorted.map((p) => p.id)).toEqual([9, 4])
  })
})
```

- [ ] **Step 2: Instalar jsdom**

`storage.test.ts` necesita `localStorage`, que no existe en el entorno `node` de Vitest.

```bash
npm install -D jsdom
```

El entorno se selecciona **por archivo** con un comentario en la primera línea —
ya está puesto en el test del paso anterior:

```ts
// @vitest-environment jsdom
```

No se usa `environmentMatchGlobs` en `vite.config.ts`: está deprecado en Vitest 3 y
eliminado en Vitest 4. El comentario por archivo funciona en todas las versiones y deja
el resto de los tests en `node`, que es más rápido.

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './storage'`.

- [ ] **Step 4: Añadir `Session` a `src/lib/types.ts`**

Añadir al final del archivo:

```ts
/** Estado del conteo en curso. Vive en localStorage hasta que se envía. */
export interface Session {
  counterName: string
  /** Clave: id de producto. `null` = saltado explícitamente. */
  amounts: Record<number, number | null>
}
```

- [ ] **Step 5: Escribir `src/lib/storage.ts`**

```ts
import { ZONES, type CountEntry, type Product, type Session } from './types'

const KEY = 'suministros-anceu:session'

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
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 10 tests nuevos.

- [ ] **Step 7: Escribir `src/styles.css`**

```css
:root {
  --bg: #faf9f7;
  --fg: #1c1a17;
  --muted: #6b655c;
  --line: #e0dcd5;
  --accent: #2f6f4f;
  font-family: system-ui, -apple-system, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
}

.app {
  max-width: 30rem;
  margin: 0 auto;
  padding: 1rem 1rem 4rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0 1rem;
}

.lang button {
  background: none;
  border: 0;
  color: var(--muted);
  font-size: 0.95rem;
  padding: 0.25rem 0.4rem;
  cursor: pointer;
}
.lang button[aria-pressed='true'] {
  color: var(--fg);
  font-weight: 600;
  text-decoration: underline;
}

.zone {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 0.25rem;
}

.progress {
  font-size: 0.85rem;
  color: var(--muted);
}

.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  padding: 1rem;
  text-align: center;
}

.card img {
  width: 100%;
  max-width: 11rem;
  height: 11rem;
  object-fit: contain;
  margin: 0 auto 0.5rem;
  display: block;
}

.card h2 {
  font-size: 1.35rem;
  margin: 0 0 0.15rem;
}

.froiz-name {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0 0 0.75rem;
}

.target {
  font-size: 1rem;
  color: var(--muted);
  margin: 0 0 0.75rem;
}

.card input[type='number'] {
  width: 100%;
  font-size: 2.5rem;
  text-align: center;
  padding: 0.5rem;
  border: 2px solid var(--line);
  border-radius: 0.5rem;
  background: #fff;
  color: var(--fg);
}
.card input[type='number']:focus {
  outline: none;
  border-color: var(--accent);
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

button.primary,
button.secondary,
button.ghost {
  flex: 1;
  font-size: 1.05rem;
  padding: 0.85rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--line);
  cursor: pointer;
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
button.secondary { background: #fff; color: var(--fg); }
button.ghost { background: none; border-color: transparent; color: var(--muted); }
button:disabled { opacity: 0.5; cursor: default; }

label { display: block; margin-bottom: 1rem; }
label span { display: block; font-size: 0.9rem; color: var(--muted); margin-bottom: 0.25rem; }
label input[type='text'] {
  width: 100%;
  font-size: 1.1rem;
  padding: 0.7rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
}

table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
td { padding: 0.5rem 0.25rem; border-bottom: 1px solid var(--line); }
td.num { text-align: right; white-space: nowrap; }
td.skipped { color: var(--muted); font-style: italic; }
tr.short td.num { color: #a3341f; font-weight: 600; }

.error {
  background: #fdecea;
  border: 1px solid #f5c2bb;
  color: #8a2114;
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}
```

- [ ] **Step 8: Escribir `src/components/ProductCard.tsx`**

```tsx
import type { Lang } from '../lib/i18n'
import { productName, t, unitLabel } from '../lib/i18n'
import type { Product } from '../lib/types'

interface Props {
  product: Product
  lang: Lang
  value: number | null | undefined
  onChange: (amount: number | null) => void
}

export function ProductCard({ product, lang, value, onChange }: Props) {
  const s = t(lang)
  const unit = unitLabel(product.unit, lang)

  return (
    <div className="card">
      <img src={product.image} alt="" />
      <h2>{productName(product, lang)}</h2>
      <p className="froiz-name">{product.froiz_name}</p>
      <p className="target">
        {s.shouldBe}: {product.target} {unit}
      </p>
      <label>
        <span>{s.howMany}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          autoFocus
          value={value ?? ''}
          onChange={(event) => {
            const raw = event.target.value
            onChange(raw === '' ? null : Math.max(0, Math.trunc(Number(raw))))
          }}
        />
      </label>
    </div>
  )
}
```

`inputMode="numeric"` es lo que hace que el móvil saque el teclado de números. `alt=""` porque la foto es decorativa: el nombre ya está en el `<h2>`, y un lector de pantalla no debe leerlo dos veces.

- [ ] **Step 9: Escribir `src/screens/Start.tsx`**

```tsx
import type { Lang } from '../lib/i18n'
import { t } from '../lib/i18n'

interface Props {
  lang: Lang
  total: number
  counterName: string
  hasSaved: boolean
  onNameChange: (name: string) => void
  onStart: () => void
  onResume: () => void
  onStartOver: () => void
}

export function Start({
  lang,
  total,
  counterName,
  hasSaved,
  onNameChange,
  onStart,
  onResume,
  onStartOver,
}: Props) {
  const s = t(lang)

  return (
    <>
      <h1>{s.appTitle}</h1>
      <p>{s.intro}</p>
      <p className="progress">
        {total} {lang === 'es' ? 'productos' : 'products'}
      </p>

      <label>
        <span>{s.yourName}</span>
        <input
          type="text"
          value={counterName}
          placeholder={s.yourNamePlaceholder}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>

      {hasSaved ? (
        <div className="actions">
          <button type="button" className="primary" onClick={onResume}>
            {s.resume}
          </button>
          <button type="button" className="ghost" onClick={onStartOver}>
            {s.startOver}
          </button>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="primary" onClick={onStart}>
            {s.start}
          </button>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 10: Escribir `src/screens/Count.tsx`**

```tsx
import { t, type Lang, type Strings } from '../lib/i18n'
import type { Product, Zone } from '../lib/types'
import { ProductCard } from '../components/ProductCard'

const ZONE_KEY: Record<Zone, keyof Strings> = {
  cocina: 'zoneCocina',
  limpieza: 'zoneLimpieza',
  comida: 'zoneComida',
  bebidas: 'zoneBebidas',
  cafeteria: 'zoneCafeteria',
}

interface Props {
  lang: Lang
  products: Product[]
  index: number
  amounts: Record<number, number | null>
  onSet: (id: number, amount: number | null) => void
  onBack: () => void
  onNext: () => void
}

export function Count({ lang, products, index, amounts, onSet, onBack, onNext }: Props) {
  const s = t(lang)
  const product = products[index]
  const isLast = index === products.length - 1
  const value = amounts[product.id]
  const answered = typeof value === 'number'

  return (
    <>
      <div className="topbar">
        <p className="zone">{s[ZONE_KEY[product.location]]}</p>
        <p className="progress">
          {index + 1} {s.progress} {products.length}
        </p>
      </div>

      <ProductCard
        product={product}
        lang={lang}
        value={value}
        onChange={(amount) => onSet(product.id, amount)}
      />

      <div className="actions">
        <button type="button" className="secondary" onClick={onBack} disabled={index === 0}>
          {s.back}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            onSet(product.id, null)
            onNext()
          }}
        >
          {s.skip}
        </button>
        <button type="button" className="primary" onClick={onNext} disabled={!answered}>
          {isLast ? s.review : s.next}
        </button>
      </div>
    </>
  )
}
```

**Saltar escribe `null` explícitamente** y avanza. `Siguiente` está deshabilitado hasta que haya un número: así no se avanza sin decidir, y "no queda ninguno" (0) nunca se confunde con "no lo miré" (`null`).

- [ ] **Step 11: Reescribir `src/App.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import './styles.css'
import productsJson from './products.json'
import { loadLang, saveLang, type Lang } from './lib/i18n'
import { clearSession, loadSession, saveSession, sortByZone } from './lib/storage'
import type { Product, Session } from './lib/types'
import { Start } from './screens/Start'
import { Count } from './screens/Count'

type Screen = 'start' | 'count'

const EMPTY: Session = { counterName: '', amounts: {} }

export function App() {
  const products = useMemo(() => sortByZone(productsJson as Product[]), [])

  const [lang, setLang] = useState<Lang>(loadLang)
  const [screen, setScreen] = useState<Screen>('start')
  const [index, setIndex] = useState(0)
  const [session, setSession] = useState<Session>(EMPTY)
  const [saved, setSaved] = useState<Session | null>(null)

  useEffect(() => {
    setSaved(loadSession())
  }, [])

  useEffect(() => {
    saveLang(lang)
  }, [lang])

  function persist(next: Session): void {
    setSession(next)
    saveSession(next)
  }

  function setAmount(id: number, amount: number | null): void {
    persist({ ...session, amounts: { ...session.amounts, [id]: amount } })
  }

  function goNext(): void {
    if (index < products.length - 1) setIndex(index + 1)
  }

  return (
    <main className="app">
      <div className="lang">
        <button type="button" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>
          ES
        </button>
        <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
          EN
        </button>
      </div>

      {screen === 'start' && (
        <Start
          lang={lang}
          total={products.length}
          counterName={session.counterName}
          hasSaved={saved !== null}
          onNameChange={(counterName) => persist({ ...session, counterName })}
          onStart={() => setScreen('count')}
          onResume={() => {
            if (saved) setSession(saved)
            setScreen('count')
          }}
          onStartOver={() => {
            clearSession()
            setSaved(null)
            setSession(EMPTY)
            setScreen('count')
          }}
        />
      )}

      {screen === 'count' && (
        <Count
          lang={lang}
          products={products}
          index={index}
          amounts={session.amounts}
          onSet={setAmount}
          onBack={() => setIndex(Math.max(0, index - 1))}
          onNext={goNext}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 12: Verificar a mano en el navegador**

Run: `npm run dev`

Comprobar:
- Las 46 cards aparecen con foto, agrupadas por zona en el orden cocina → limpieza → comida → bebidas → cafetería.
- El toggle ES/EN cambia los textos y los nombres de producto, y sobrevive a un recargo de página.
- Meter un número y recargar: el valor sigue ahí (`localStorage`).
- `Siguiente` está gris hasta meter un número; `Saltar` avanza siempre.
- En el móvil (o con las devtools en modo móvil) el input saca teclado numérico.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: pantallas de inicio y conteo con persistencia en localStorage"
```

---

## Task 9: Revisión y envío

**Files:**
- Create: `src/screens/Review.tsx`, `src/screens/Sent.tsx`
- Modify: `src/App.tsx`, `src/screens/Count.tsx`
- Test: `src/screens/Review.test.tsx`

**Interfaces:**
- Consumes: todo lo anterior; `POST /api/send`.
- Produces: `App` completa el ciclo `start → count → review → sent`.

- [ ] **Step 1: Instalar las utilidades de test de React**

```bash
npm install -D @testing-library/react @testing-library/dom
```

El entorno va por archivo (`// @vitest-environment jsdom`), igual que en la Task 8.

- [ ] **Step 2: Escribir el test que falla**

`src/screens/Review.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Review } from './Review'
import type { Product } from '../lib/types'

// Sin `globals: true` en la config, Testing Library no registra su limpieza
// automática: sin esto, el segundo `render` deja dos copias en el documento y
// `getByText` falla por encontrar varias coincidencias.
afterEach(cleanup)

function product(id: number, name: string, target: number): Product {
  return {
    id,
    name,
    name_en: name,
    froiz_name: name,
    froiz_url: `https://supermercado.froiz.com/product/${id}-x`,
    image: `/img/${id}.jpg`,
    target,
    unit: 'ud',
    location: 'cocina',
  }
}

const products = [product(1, 'Papel de cocina', 7), product(2, 'Estropajos', 4)]
const noop = () => {}

describe('Review', () => {
  it('muestra lo contado y marca lo saltado como sin contar', () => {
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: null }}
        counterName="Bartek"
        status="idle"
        onEdit={noop}
        onSend={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByText('Papel de cocina')).toBeDefined()
    expect(screen.getByText('sin contar')).toBeDefined()
  })

  it('deshabilita enviar mientras esta enviando', () => {
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: 4 }}
        counterName="Bartek"
        status="sending"
        onEdit={noop}
        onSend={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Enviando…' })).toHaveProperty('disabled', true)
  })

  it('muestra el error y ofrece reintentar sin perder los datos', () => {
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: 4 }}
        counterName="Bartek"
        status="error"
        onEdit={noop}
        onSend={noop}
        onBack={noop}
      />,
    )
    expect(screen.getByText(/No se pudo enviar/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined()
    expect(screen.getByText('4')).toBeDefined()
  })

  it('llama a onEdit con el indice del producto pulsado', () => {
    const onEdit = vi.fn()
    render(
      <Review
        lang="es"
        products={products}
        amounts={{ 1: 4, 2: 4 }}
        counterName="Bartek"
        status="idle"
        onEdit={onEdit}
        onSend={noop}
        onBack={noop}
      />,
    )
    screen.getAllByRole('button', { name: 'Cambiar' })[1].click()
    expect(onEdit).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './Review'`.

- [ ] **Step 4: Escribir `src/screens/Review.tsx`**

```tsx
import { productName, t, type Lang } from '../lib/i18n'
import type { Product } from '../lib/types'

export type SendStatus = 'idle' | 'sending' | 'error'

interface Props {
  lang: Lang
  products: Product[]
  amounts: Record<number, number | null>
  counterName: string
  status: SendStatus
  onEdit: (index: number) => void
  onSend: () => void
  onBack: () => void
}

export function Review({
  lang,
  products,
  amounts,
  counterName,
  status,
  onEdit,
  onSend,
  onBack,
}: Props) {
  const s = t(lang)

  return (
    <>
      <h1>{s.reviewTitle}</h1>
      {counterName && <p className="progress">{counterName}</p>}

      {status === 'error' && <p className="error">{s.sendFailed}</p>}

      <table>
        <tbody>
          {products.map((product, index) => {
            const value = amounts[product.id]
            const counted = typeof value === 'number'
            const short = counted && value < product.target
            return (
              <tr key={product.id} className={short ? 'short' : undefined}>
                <td>{productName(product, lang)}</td>
                <td className={counted ? 'num' : 'num skipped'}>
                  {counted ? value : s.notCountedLabel}
                </td>
                <td className="num">/ {product.target}</td>
                <td className="num">
                  <button type="button" className="ghost" onClick={() => onEdit(index)}>
                    {s.edit}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={onBack}
          disabled={status === 'sending'}
        >
          {s.back}
        </button>
        <button
          type="button"
          className="primary"
          onClick={onSend}
          disabled={status === 'sending'}
        >
          {status === 'sending' ? s.sending : status === 'error' ? s.retry : s.send}
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 4 tests nuevos.

- [ ] **Step 6: Escribir `src/screens/Sent.tsx`**

```tsx
import { t, type Lang } from '../lib/i18n'

export function Sent({ lang }: { lang: Lang }) {
  const s = t(lang)
  return (
    <>
      <h1>{s.sentTitle}</h1>
      <p>{s.sentBody}</p>
    </>
  )
}
```

- [ ] **Step 7: Conectar las pantallas en `src/App.tsx`**

Cambios sobre el archivo de la Task 8:

Ampliar el tipo y los imports. `toCountEntries` se añade a la línea de import de
`./lib/storage` que ya existe, no en una nueva:

```tsx
import { clearSession, loadSession, saveSession, sortByZone, toCountEntries } from './lib/storage'
import { Review, type SendStatus } from './screens/Review'
import { Sent } from './screens/Sent'

type Screen = 'start' | 'count' | 'review' | 'sent'
```

Añadir el estado de envío junto a los demás `useState`:

```tsx
const [status, setStatus] = useState<SendStatus>('idle')
```

Sustituir `goNext` para que la última card lleve a la revisión:

```tsx
function goNext(): void {
  if (index < products.length - 1) {
    setIndex(index + 1)
  } else {
    setScreen('review')
  }
}
```

Añadir el envío:

```tsx
async function send(): Promise<void> {
  setStatus('sending')
  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        counter_name: session.counterName,
        counts: toCountEntries(session),
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    // Sólo aquí se borra: antes de que Resend confirme, los datos se quedan.
    clearSession()
    setSaved(null)
    setStatus('idle')
    setScreen('sent')
  } catch {
    setStatus('error')
  }
}
```

Añadir las dos pantallas antes del cierre de `<main>`:

```tsx
{screen === 'review' && (
  <Review
    lang={lang}
    products={products}
    amounts={session.amounts}
    counterName={session.counterName}
    status={status}
    onEdit={(target) => {
      setStatus('idle')
      setIndex(target)
      setScreen('count')
    }}
    onSend={send}
    onBack={() => {
      setStatus('idle')
      setScreen('count')
    }}
  />
)}

{screen === 'sent' && <Sent lang={lang} />}
```

- [ ] **Step 8: Verificar el ciclo completo a mano**

Run: `npm run dev`

Con `RESEND_API_KEY` sin configurar, el endpoint devuelve 500 — perfecto para probar el camino de error:
- Contar unos cuantos productos, saltar uno, llegar a la revisión.
- `Cambiar` en una fila vuelve a esa card.
- Pulsar `Enviar`: aparece el error y **los números siguen en la tabla**. Recargar: siguen ahí.
- Crear `.dev.vars` con `RESEND_API_KEY=<key real>`, reiniciar, y enviar de verdad. Comprobar el correo en `hello@anceu.com`: asunto con el número, `TO BUY` con URLs, `FULL INVENTORY`, `NOT COUNTED`.
- Tras el envío correcto, recargar: la sesión está limpia y vuelve a la pantalla de inicio.

**`.dev.vars` está en `.gitignore`. Verificar con `git status` que no aparece antes de commitear.**

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: pantalla de revision, envio con reintento y confirmacion"
```

---

## Task 10: Añadir productos sin volver al sheet

**Files:**
- Create: `scripts/add-product.ts`
- Modify: `package.json` (script `add`)
- Test: `scripts/add-product.test.ts`

**Interfaces:**
- Consumes: `fetchFroizProduct` de `scripts/froiz.ts`.
- Produces:
  - `productIdFromUrl(url: string): number`
  - `seedLine(id, zone, target, unit, name, name_en): string`
  - `npm run add -- <url-froiz> <zona> <objetivo> <unidad> "<nombre es>" "<nombre en>"`

- [ ] **Step 1: Escribir el test que falla**

`scripts/add-product.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { productIdFromUrl, seedLine } from './add-product'

describe('productIdFromUrl', () => {
  it('extrae el id de una url de tienda', () => {
    expect(
      productIdFromUrl('https://supermercado.froiz.com/product/15592-leche-froiz-sin-lactosa-semidesnatada-1l'),
    ).toBe(15592)
  })

  it('tolera el # que arrastran algunas urls copiadas', () => {
    expect(productIdFromUrl('https://supermercado.froiz.com/product/1827-manzanilla-froiz-25-bolsitas#')).toBe(1827)
  })

  it('falla con una url que no es de producto', () => {
    expect(() => productIdFromUrl('https://supermercado.froiz.com/')).toThrow(/url/i)
  })
})

describe('seedLine', () => {
  it('separa por tabuladores', () => {
    expect(seedLine(15592, 'cafeteria', 12, 'ud', 'Leche sin lactosa', 'Lactose-free milk')).toBe(
      '15592\tcafeteria\t12\tud\tLeche sin lactosa\tLactose-free milk',
    )
  })

  it('rechaza nombres con tabulador, que romperian el tsv', () => {
    expect(() => seedLine(1, 'cocina', 1, 'ud', 'a\tb', 'c')).toThrow(/tab/i)
  })
})
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './add-product'`.

- [ ] **Step 3: Escribir `scripts/add-product.ts`**

```ts
import { appendFileSync, readFileSync } from 'node:fs'
import { fetchFroizProduct } from './froiz'
import { ZONES, type Unit, type Zone } from '../src/lib/types'

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
  if (!ZONES.includes(zone as Zone)) throw new Error(`Zona desconocida: ${zone} (${ZONES.join(', ')})`)
  if (!UNITS.includes(unit as Unit)) throw new Error(`Unidad desconocida: ${unit} (${UNITS.join(', ')})`)

  const id = productIdFromUrl(url)
  if (readFileSync(SEED, 'utf8').split('\n').some((line) => line.startsWith(`${id}\t`))) {
    throw new Error(`El producto ${id} ya está en seed.tsv`)
  }

  // Se consulta la API antes de escribir: si el producto no existe o está
  // descatalogado, mejor enterarse ahora que en el próximo build del catálogo.
  const froiz = await fetchFroizProduct(id)
  console.log(`Froiz dice: ${froiz.name} (${froiz.measurement_unit})`)

  appendFileSync(
    SEED,
    `${seedLine(id, zone as Zone, Number(target), unit as Unit, name, nameEn)}\n`,
  )

  console.log(
    `Añadido ${id} a scripts/seed.tsv.\n` +
      'Mueve la línea a su bloque de zona (el test lo exige) y ejecuta: npm run catalog',
  )
}

if (process.argv[1]?.endsWith('add-product.ts')) {
  await main()
}
```

El guardia `if (process.argv[1]?.endsWith(...))` es lo que permite importar las funciones desde el test sin que se ejecute `main`.

- [ ] **Step 4: Añadir el script a `package.json`**

```json
"add": "tsx scripts/add-product.ts"
```

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 5 tests nuevos.

- [ ] **Step 6: Verificar el rechazo de duplicados**

Run: `npm run add -- https://supermercado.froiz.com/product/2565-papel-higienico-froiz-doble-capa-24-u cocina 3 ud "Papel higiénico" "Toilet paper"`
Expected: falla con `El producto 2565 ya está en seed.tsv`, y `seed.tsv` no cambia (`git diff --stat` vacío).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: script para añadir un producto desde una url de Froiz"
```

---

## Task 11: Despliegue

**Files:**
- Create: `README.md`
- Modify: ninguno.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la app en producción y el `README` con lo necesario para operarla.

**Requiere acción de Agustín** en los pasos 1 y 2 (DNS de Resend y la API key). El resto es ejecutable.

- [ ] **Step 1: Verificar el subdominio en Resend**

En el panel de Resend, añadir el dominio **`send.anceu.com`** y crear los registros DNS que indique.

**Es `send.anceu.com`, no `anceu.com`:** verificar el dominio raíz tocaría los registros del correo real de Anceu. Un subdominio dedicado deja los MX de `anceu.com` intactos.

- [ ] **Step 2: Guardar la API key como secreto del Worker**

```bash
npx wrangler secret put RESEND_API_KEY
```

Pegar la key cuando lo pida. **No** añadirla a `wrangler.jsonc` ni a ningún `.env` versionado.

- [ ] **Step 3: Verificar que el build y los tests pasan antes de desplegar**

```bash
npm test
npm run build
```
Expected: todos los tests en verde, `tsc --noEmit` sin errores, build de Vite correcto.

- [ ] **Step 4: Desplegar**

```bash
npm run deploy
```
Expected: Wrangler imprime la URL `https://suministros-anceu.<subdominio>.workers.dev`.

- [ ] **Step 5: Probar en producción**

```bash
curl -s https://<url-desplegada>/api/ping
curl -s -o /dev/null -w '%{http_code}\n' https://<url-desplegada>/api/send
curl -s -X POST https://<url-desplegada>/api/send \
  -H 'content-type: application/json' -d '{"counts":[{"id":999,"amount":1}]}'
```
Expected: `{"ok":true}`; `405`; y un `400` con `unknown product id 999`.

Luego abrir la URL en el móvil, contar tres productos, saltar uno, enviar, y comprobar que el correo llega a `hello@anceu.com` con el asunto y las tres secciones.

- [ ] **Step 6: Escribir `README.md`**

```markdown
# Suministros Anceu

Webapp para contar el stock de suministros del coliving. Se recorre la casa
producto por producto y al acabar envía a `hello@anceu.com` lo que hay, lo que
debería haber y lo que falta comprar.

El correo va en inglés y con formato fijo porque lo procesa una IA para montar
el pedido de Froiz, siguiendo el runbook `froiz-punctual-order.v1.md` de
`productivity-anceu`.

- Diseño: [`docs/superpowers/specs/2026-07-31-suministros-anceu-design.md`](docs/superpowers/specs/2026-07-31-suministros-anceu-design.md)
- Plan: [`docs/superpowers/plans/2026-07-31-suministros-anceu.md`](docs/superpowers/plans/2026-07-31-suministros-anceu.md)

## Desarrollo

```bash
npm install
npm run dev      # SPA + Worker en local
npm test
```

Para probar el envío en local, crear `.dev.vars` (ignorado por git):

```
RESEND_API_KEY=re_...
```

## Añadir o cambiar un producto

El catálogo se genera; **no editar `src/products.json` a mano**. La fuente es
`scripts/seed.tsv` (id, zona, objetivo, unidad, nombre ES, nombre EN).

```bash
npm run add -- <url-froiz> <zona> <objetivo> <unidad> "<nombre es>" "<nombre en>"
# mover la línea a su bloque de zona, y luego:
npm run catalog
```

`npm run catalog` consulta la API pública de Froiz, escribe
`src/products.json` y descarga las fotos a `public/img/`.

**Las fotos se descargan, no se enlazan.** La URL de imagen de Froiz viene
firmada con caducidad; hoy la firma no se valida, pero si Froiz la activa, las
cards se quedarían sin foto en silencio.

## Despliegue

```bash
npx wrangler secret put RESEND_API_KEY   # una sola vez
npm run deploy
```

El remitente es `no-reply@send.anceu.com` (subdominio verificado en Resend,
elegido para no tocar los MX de `anceu.com`). El destinatario está fijo en
`worker/index.ts` a propósito: el endpoint es público y un destinatario
parametrizable sería un relay de spam.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: README con desarrollo, mantenimiento del catalogo y despliegue"
```

---

## Notas para quien revise

**Una desviación deliberada respecto al spec.** El spec describía derivar `unit` con un
algoritmo (paréntesis del sheet primero, API después). El plan lo convierte en una
**columna humana de `seed.tsv`** y deja a la API sólo el papel de avisar de discrepancias
(`warnUnitMismatch`). El motivo es Estrella Galicia: la unidad no es un dato que se pueda
derivar, es un juicio — el sheet decía "pack de 6", Froiz vende packs de 12, y ninguna
regla automática habría resuelto cuál vale. Mismo resultado, con la decisión en un sitio
donde se ve y se puede corregir.

**Lo que este plan da por bueno sin verificar:**

- **Los objetivos vienen del Google Sheet sin cuestionarlos.** Si alguno está mal (y el estado del sheet sugiere que alguno lo está), el primer correo real lo enseñará. Corregirlo es editar `scripts/seed.tsv` y volver a lanzar `npm run catalog`.
- **Las traducciones al inglés las escribí a partir del nombre canónico de Froiz.** `Nanita` → *Cleaning pad (delicate surfaces)* es correcto pero no evidente; merecen una pasada humana.
- **Estrella Galicia:** corregí la etiqueta del pack de 6 a 12 botellas porque el producto de Froiz es `pack-12x25-cl`. **El objetivo sigue en 6 packs.** Si la casa quería 6 packs *de 6*, el objetivo debería bajar, y eso es decisión de Agustín, no de la implementación.
