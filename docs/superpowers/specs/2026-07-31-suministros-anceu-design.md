# Suministros Anceu — diseño

**Fecha:** 2026-07-31
**Estado:** aprobado, pendiente de plan de implementación

## Problema

El stock de suministros comunes del coliving (papel, limpieza, café, bebidas) vive en la
pestaña `Coliving groceries` de un Google Sheet, descrita en
`productivity-anceu/runbooks/anceu/weekly-groceries.v2.md`.

Ese sheet tiene cinco columnas: `Item`, `Current amount in the coliving`, `Froiz link`,
`To buy`, `Amount that should be in the coliving`.

**Nadie cuenta el stock.** El setup semanal (`weekly-groceries-setup.v1.py --apply`) copia
el objetivo sobre la cantidad actual, asumiendo que la entrega anterior dejó la casa al
objetivo. La suposición es falsa y el error se acumula. Estado del sheet al escribir esto:

| Producto | Hay (según el sheet) | Objetivo |
|---|---|---|
| Estrella Galicia | 12 packs | 6 |
| Café en grano | 6 | 5 |
| Café descafeinado | 6 | 4 |
| Manzanilla | 4 | 2 |

`To buy` es una fórmula (`objetivo − actual`), así que produce negativos que
`froiz-order-sync.v1.py` descarta silenciosamente con `> 0`. El resultado es que el pedido
sale de una foto del stock que nadie ha verificado nunca.

## Qué construimos

Una webapp que una persona del equipo abre en el móvil, recorre la casa producto por
producto metiendo cuánto hay de cada cosa, y al acabar envía un correo a
`hello@anceu.com` con **lo que hay, lo que debería haber y lo que falta comprar**.

El correo va en inglés y con formato fijo porque **lo procesa una IA** para montar el
pedido, siguiendo el runbook `froiz-punctual-order.v1.md` (lista suelta → carrito Froiz).

### Fuera de alcance (v1)

- **La app no escribe en el Google Sheet.** El reset semanal ficticio sigue existiendo; el
  correo lo esquiva. Los conteos quedan en el correo, que es el nuevo punto de verdad
  operativo.
- **Sin base de datos y sin histórico.** El estado vive en el navegador durante el conteo y
  se descarta al enviar. Si más adelante se quiere histórico ("cada semana se van 6
  rollos"), se añade entonces.
- **Sin login.** Es una URL que no está publicada en ningún sitio. El peor caso es que
  alguien envíe un inventario falso, que se detecta al leerlo.

## Arquitectura

Un único Worker de Cloudflare sirve el SPA y atiende el endpoint de envío. Un solo
despliegue, un solo dominio.

```
suministros-anceu/
  src/
    products.json           ← catálogo: 46 productos
    App.tsx                 ← flujo de conteo
    lib/shortfall.ts        ← cálculo hay / debería / falta
    lib/email.ts            ← construcción del cuerpo del correo
    lib/i18n.ts             ← ES (por defecto) / EN
  public/img/{id}.jpg       ← fotos de producto descargadas de Froiz
  worker/index.ts           ← POST /api/send → Resend
  scripts/add-product.ts    ← añadir producto desde una URL de Froiz
  wrangler.jsonc
```

`shortfall.ts` y `email.ts` viven fuera de los componentes porque son la única lógica real
del proyecto y tienen que ser testeables sin navegador. El resto es interfaz.

**Stack:** React + Vite + TypeScript. `@cloudflare/vite-plugin` para que el Worker corra
dentro de `vite dev` y el desarrollo local sea lo mismo que se despliega.

## Catálogo

### Formato (`src/products.json`)

```json
{
  "id": 21716,
  "name": "Nanita",
  "name_en": "Cleaning pad (delicate surfaces)",
  "froiz_name": "Almohadilla limpieza Froiz superficies delicadas 2 u",
  "froiz_url": "https://supermercado.froiz.com/product/21716-almohadilla-limpieza-froiz-superficies-delicadas-2-u",
  "image": "/img/21716.jpg",
  "target": 4,
  "unit": "ud",
  "location": "cocina"
}
```

- `name` — el nombre del sheet, que es como lo llama la casa.
- `name_en` — traducción. El sheet ya trae unos 20 en formato `"Papel higienico / toilet
  paper"`, que se parten por `" / "`. El resto se traducen a partir del nombre canónico de
  Froiz.
- `froiz_name` — nombre canónico de la API. Se muestra pequeño bajo el nombre principal:
  `Nanita` no le dice nada a quien acaba de llegar, `Almohadilla limpieza Froiz` sí.
- `unit` — código corto: `ud`, `pack`, `bolsa`, `kg`. Necesario porque Froiz cobra distinto
  en `ud` que en `kg`, y porque la card debe decir *"deberían haber 6 packs"* y no un
  paréntesis a medias. Se muestra traducido según el idioma activo (`pack` → *packs*,
  `bolsa` → *bags*).

**Cómo se deriva `unit`** — la API no basta, y el orden importa:

1. **Si el nombre del sheet trae un paréntesis de formato**, manda ése:
   `( pack de 6 botellas / 6 bottle pack)` → `pack`, `( bag / bolsa )` → `bolsa`,
   `( unit )` → `ud`. La API devuelve `measurement_unit: "Unidad"` también para los packs,
   así que si nos fiásemos sólo de ella perderíamos que Estrella Galicia se cuenta **por
   packs de 6**, no por botellas — y el pedido saldría con seis veces menos cerveza.
2. **Si no hay paréntesis**, se usa la API: `measurement_unit` `"Unidad"` → `ud`, y
   `per_unit && fractional` → `kg`.

### Generación

El catálogo se genera una vez cruzando la pestaña `Coliving groceries` con la **API pública
de Froiz** (`GET https://servicios.froiz.com/api/products/{id}`, sin autenticación). De la
API salen nombre canónico, unidad e `image_id`.

Las fotos **se descargan al repo**, no se enlazan. La API devuelve una URL firmada
(`?exp=…&sig=…`) cuya firma hoy **no se valida** — la URL sin firma sirve la misma imagen.
Es decir: funciona por accidente. Si Froiz activa la validación, las 46 cards se quedan sin
foto en silencio, justo mientras alguien cuenta. Descargarlas cuesta poco: la muestra pesa
7 KB, así que las 46 rondan 300–500 KB, y se sirven desde el edge de Cloudflare, que
importa porque la conexión en Anceu es rural.

URL estable de imagen (por si hay que regenerar):
`https://imagedelivery.net/laxGYDNZyT04iZVpzPzryw/{image_id}/desktop`

### Mantenimiento

Añadir un producto no requiere volver al sheet:

```
scripts/add-product.ts <url-froiz> <objetivo> <zona>
```

Llama a la API, extrae nombre y unidad, descarga la foto y añade la entrada al JSON. Es el
flujo de "se lo paso a una IA con el link y cuánto debería haber", hecho reproducible.

## Flujo de la app

1. **Inicio** — título, "46 productos", campo opcional *tu nombre*, botón empezar. El
   nombre va en el correo: si los números no cuadran, hay que saber a quién preguntar.
2. **Una card por producto**, con:
   - foto del producto,
   - nombre en el idioma activo, y `froiz_name` debajo en pequeño,
   - `deberían haber 4 ud` — con la unidad explícita,
   - input numérico grande, `inputMode="numeric"` para que el móvil saque el teclado
     numérico,
   - progreso `12/46`.
3. **Agrupadas por zona**, en el orden del sheet: cocina → limpieza → comida → bebidas →
   cafetería. Cabecera al cambiar de zona. El orden importa: es para recorrer la casa una
   vez, no ir del baño a la despensa y volver.
4. **Atrás / siguiente**, para poder corregir.
5. **Saltar es explícito** y se registra como *no contado*, no como cero. "No queda
   ninguno" y "no lo miré" no pueden llegar iguales al correo.
6. **Revisión final** — lista completa con lo introducido, editable. Enviar es
   irreversible, así que hay una pantalla antes.
7. **Enviar** → confirmación.

### Persistencia durante el conteo

Los conteos se guardan en `localStorage` **a cada cambio**. Alguien va a bloquear el móvil
en el producto 20, o le va a entrar una llamada. Sin esto pierde el conteo entero, y no lo
repite. Se borra sólo tras un envío con éxito.

### Fallo de envío

Mensaje de error con botón de reintentar, y **los datos siguen ahí**. Nunca vaciar el
estado antes de que Resend confirme.

## Cálculo (`lib/shortfall.ts`)

```
falta = max(0, objetivo − hay)
```

El `max(0, …)` es deliberado: replica lo que hace el sistema actual de facto. La fórmula del
sheet da negativos (Estrella Galicia: `6 − 12 = −6`) y `froiz-order-sync` los filtra con
`> 0`. Sin el clamp, un exceso de stock generaría una línea de compra negativa.

Un producto **no contado** no genera línea de compra y no cuenta como 0.

## El correo

Texto plano, en inglés. Sin HTML: lo parsea una IA y el texto plano no tiene nada que se
pueda romper.

```
Subject: [Anceu] Supplies — 7 to buy (2026-07-31)

Counted by: Bartek — 2026-07-31 18:42

TO BUY (7)
Papel de cocina      have 4   should be 7   buy 3 ud    https://supermercado.froiz.com/product/38762-...
Lejia con detergente have 2   should be 5   buy 3 ud    https://supermercado.froiz.com/product/4976-...
...

FULL INVENTORY (44 counted)
Papel higienico      have 3   should be 3   OK
Papel de cocina      have 4   should be 7
...

NOT COUNTED (2)
Estropajo
Bolsas de basura 100 L
```

**Las secciones no se solapan y suman el catálogo:** `FULL INVENTORY` lista sólo los
productos contados, `NOT COUNTED` el resto, y `44 + 2 = 46`. Un producto no contado aparece
en `NOT COUNTED` y en ningún otro sitio — no se le inventa un `have 0`.

- El **asunto lleva el número** para saber desde la bandeja si hay que pedir sin abrirlo.
- `TO BUY` enchufa directo en `froiz-punctual-order.v1.md`: nombre, cantidad, unidad y URL
  de producto es exactamente lo que necesita para montar el carrito.
- `FULL INVENTORY` existe por una razón concreta, no por completismo: sin él no se
  distingue *"hay de sobra"* de *"esa card se la saltó"*. Ambas producen silencio en la
  sección `TO BUY`.

## Worker y seguridad

`POST /api/send` recibe `{ counter_name, counts: [{ id, amount | skipped }] }`.

- `counter_name` es **opcional**. Si viene vacío, el correo pone
  `Counted by: (not given)` — nunca falla el envío por eso.
- **La fecha y la hora las pone el Worker en `Europe/Madrid`**, no el navegador ni UTC. Los
  Workers corren en UTC: un conteo a las 00:30 de la noche saldría fechado el día anterior,
  y esa fecha va en el asunto del correo.

- **El destinatario está fijo en el código del Worker** (`hello@anceu.com`). Nunca viene del
  cliente. El endpoint está abierto en internet: si el destinatario fuese un parámetro,
  sería un relay de spam firmado con el dominio de Anceu.
- **Valida la forma de la petición** y rechaza lo que no encaje: ids que no estén en el
  catálogo, cantidades no numéricas o negativas, cuerpos desproporcionados.
- **La API key de Resend es un secreto del Worker** (`wrangler secret put
  RESEND_API_KEY`). Nunca en el repo, nunca en el bundle del navegador. Ésta es la razón de
  que exista el endpoint: con un sitio puramente estático, la key iría en el JS y
  cualquiera podría enviar correo desde el dominio.
- Remitente: `no-reply@send.anceu.com`. Subdominio propio, para **no tocar los MX de
  `anceu.com`** al verificar el dominio en Resend.

## i18n

Diccionario pequeño, dos locales, toggle visible. **Español por defecto**, elección
guardada en `localStorage`. Los nombres de producto salen de `name` / `name_en` según el
idioma activo. El correo va **siempre en inglés**, independientemente del idioma de la
interfaz.

## Despliegue

```
wrangler secret put RESEND_API_KEY
wrangler deploy
```

Verificación previa, una sola vez: subdominio `send.anceu.com` en Resend (registros DNS).

## Tests

Unitarios sobre las dos piezas con lógica:

- `shortfall.ts` — el clamp a 0 con exceso de stock; *no contado* no genera línea de compra
  ni cuenta como 0; el caso `hay == objetivo`.
- `email.ts` — el asunto cuenta bien; los no contados no aparecen en `TO BUY` ni en
  `FULL INVENTORY`; `FULL INVENTORY` + `NOT COUNTED` suman los 46; sin nombre de quien
  cuenta el correo sigue saliendo válido.

La interfaz se prueba a mano.

## Decisiones tomadas

| Decisión | Motivo |
|---|---|
| Catálogo estático en el repo, no lectura del sheet en vivo | Sin credenciales de Google en el servidor. Los cambios entran por PR/agente. |
| Resend, no SMTP | En Cloudflare Workers no hay SMTP. Resend es una llamada `fetch`. Las app passwords de Google caducan y Google bloquea IPs de datacenter. |
| Cloudflare Workers, no Vercel | Preferencia del proyecto. |
| Fotos descargadas, no enlazadas | La URL firmada de Froiz podría empezar a validarse en cualquier momento. |
| Sin login | Fricción sin beneficio para una persona del equipo. |
| Correo en texto plano y en inglés | Lo consume una IA. |

## Pendiente / riesgos

- **Traducciones**: los ~26 productos sin nombre inglés se traducen a partir del nombre
  canónico de Froiz durante la implementación. Conviene una revisión humana rápida:
  `Nanita` → *cleaning pad* es correcto pero no evidente.
- **Objetivos heredados del sheet sin revisar.** Se copian tal cual. Si alguno está mal, el
  primer correo lo enseñará.
- **Sin histórico**: cada correo es una foto aislada. Es una elección de la v1, pero es la
  primera cosa que se va a echar en falta.

## Apéndice: catálogo (46 productos)

Objetivos y zonas tal como están en el sheet a 2026-07-31. La columna *hay* es lo que dice
el sheet hoy, no un conteo real — está aquí sólo como referencia de lo desfasado que está.

| Zona | ID Froiz | Producto (sheet) | Objetivo | Hay (sheet) |
|---|---|---|---|---|
| cocina | 2565 | Papel higienico / toilet paper | 3 | 3 |
| cocina | 23293 | Papel de horno / oven paper | 7 | 7 |
| cocina | 23646 | papel de aluminio | 6 | 4 |
| cocina | 5406 | pelicula de plastica | 4 | 4 |
| cocina | 38762 | papel de cocina | 7 | 4 |
| cocina | 2527 | servilletas | 6 | 3 |
| cocina | 57172 | bolsas de basura 100 L | 5 | 4 |
| cocina | 45113 | Bolsas basura / trash bin bags | 4 | 2 |
| cocina | 79223 | Bayetas | 4 | 3 |
| cocina | 27895 | Estropajo | 4 | 3 |
| cocina | 21716 | Nanita | 4 | 2 |
| limpieza | 56093 | Detergente marsella / Marsella cleaner | 4 | 4 |
| limpieza | 48857 | Suavizante Vernel Maldivas / softening agent | 4 | 2 |
| limpieza | 20124 | Insecticida | 5 | 5 |
| limpieza | 22699 | Ambientador spray | 4 | 2 |
| limpieza | 23085 | Ambientador palos | 4 | 2 |
| limpieza | 38910 | Fregasuelos | 4 | 2 |
| limpieza | 55588 | Bolas para limpieza de water | 4 | 2 |
| limpieza | 2283 | Desengrasante Zorka | 3 | 2 |
| limpieza | 4976 | Lejia con detergente | 5 | 2 |
| limpieza | 15086 | Destascador tuberias liquido | 3 | 2 |
| limpieza | 40240 | oxigeno activo | 2 | 2 |
| limpieza | 51629 | Blanqueador percarbonato | 2 | 2 |
| comida | 45365 | Helados mini twins | 3 | 1 |
| comida | 45372 | Helado sandwich | 3 | 1 |
| comida | 68507 | Helado Oreo | 3 | 1 |
| comida | 5014 | Sal gruesa | 2 | 2 |
| comida | 5034 | Sal fina | 1 | 1 |
| comida | 52790 | Oregano | 2 | 1 |
| comida | 4598 | Mantequilla | 2 | 1 |
| comida | 46677 | azucar | 2 | 1 |
| comida | 58871 | Marmelada | 4 | 3 |
| bebidas | 7292 | Shandy (pack de 6 botellas) | 5 | 5 |
| bebidas | 9753 | Coca Cola (pack de 12 latas) | 5 | 2 |
| bebidas | 9106 | Coca cola Zero (pack de 12 latas) | 2 | 1 |
| bebidas | 7670 | Estrella galicia (pack de 6 botellas) | 6 | 12 |
| bebidas | 37283 | Cerveza cero cero (pack de 6 botellas) | 2 | 3 |
| cafeteria | 51190 | Bebida vegetal avena / oat drink | 12 | 12 |
| cafeteria | 10360 | Café en grano natural / coffee beans | 5 | 6 |
| cafeteria | 41183 | Café descafeinado / decaffeinated coffee | 4 | 6 |
| cafeteria | 50152 | Té rojo / red tea | 2 | 1 |
| cafeteria | 50154 | Té verde / green tea | 2 | 3 |
| cafeteria | 1827 | Manzanilla / chamomile | 2 | 4 |
| cafeteria | 1924 | Menta poleo | 2 | 2 |
| cafeteria | 44312 | hielo (bolsa) | 5 | 5 |
| cafeteria | 15592 | leche semi sin lactosa | 12 | 6 |

**Cambios sobre el sheet, decididos en esta conversación:**

- **`Leche semidesnatada` (id 408) se elimina.** La casa se queda sólo con avena y sin
  lactosa.
- **`leche semi sin lactosa` se completa**: en el sheet no tenía ni link ni objetivo. Link:
  `https://supermercado.froiz.com/product/15592-leche-froiz-sin-lactosa-semidesnatada-1l`,
  objetivo **12 briks**.

Los `( unit )`, `( pack de 6 botellas / 6 bottle pack)` y `( bag / bolsa )` de los nombres
del sheet se extraen al campo `unit` durante la generación y desaparecen del nombre.
