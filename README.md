# Suministros Anceu

Webapp para contar el stock de suministros del coliving. Se recorre la casa
producto por producto y al acabar envía a `hello@anceu.com` lo que hay, lo que
debería haber y lo que falta comprar.

El correo va en inglés y con formato fijo porque lo procesa una IA para montar
el pedido de Froiz, siguiendo el runbook `froiz-punctual-order.v1.md` de
`productivity-anceu`.

**Por qué existe:** el stock vivía en la pestaña `Coliving groceries` de un
Google Sheet donde el setup semanal *asumía* que la entrega anterior había
dejado la casa al objetivo. Nadie contaba. El error se acumulaba: al escribir
esto el sheet creía que había 12 packs de Estrella Galicia con un objetivo de 6.

- Diseño: [`docs/superpowers/specs/2026-07-31-suministros-anceu-design.md`](docs/superpowers/specs/2026-07-31-suministros-anceu-design.md)
- Plan: [`docs/superpowers/plans/2026-07-31-suministros-anceu.md`](docs/superpowers/plans/2026-07-31-suministros-anceu.md)

## Desarrollo

```bash
npm install
npm run dev      # SPA + Worker en local, en el puerto 5173
npm test
npm run build    # tsc --noEmit + build de Vite
```

Para probar el envío en local, crear `.dev.vars` (ignorado por git):

```
RESEND_API_KEY=re_...
```

## Añadir o cambiar un producto

El catálogo se genera; **no editar `src/products.json` a mano**. La fuente es
`scripts/seed.tsv`, con las columnas `id`, `zone`, `target`, `unit`, `name` y
`name_en`.

```bash
npm run add -- <url-froiz> <zona> <objetivo> <unidad> "<nombre es>" "<nombre en>"
# mover la línea a su bloque de zona, y luego:
npm run catalog
```

`npm run catalog` consulta la API pública de Froiz
(`GET https://servicios.froiz.com/api/products/{id}`, sin login), escribe
`src/products.json` y descarga las fotos a `public/img/`.

**La unidad la decides tú en `seed.tsv`, no la API.** Froiz devuelve
`measurement_unit: "Unidad"` también para los packs: si nos fiáramos de ella,
Estrella Galicia se contaría por botellas en vez de por packs de 12, y el pedido
saldría con doce veces menos cerveza.

**Las fotos se descargan, no se enlazan.** La URL de imagen de Froiz viene
firmada con caducidad; hoy la firma no se valida, pero si Froiz la activa las 46
cards se quedarían sin foto en silencio, justo mientras alguien cuenta.

**Los productos se descatalogan sin avisar.** `npm run catalog` recorre los 46
aunque alguno falle y lista al final todo lo roto, sin escribir
`products.json`. Un 404 casi siempre significa producto retirado: busca recambio
con `https://servicios.froiz.com/api/products?term=<texto>`.

## Despliegue

```bash
npx wrangler login                       # una sola vez
npx wrangler secret put RESEND_API_KEY   # una sola vez
npm run deploy
```

El remitente es `no-reply@send.anceu.com`, un subdominio verificado en Resend
elegido para **no tocar los MX de `anceu.com`**.

El destinatario está fijo en `worker/index.ts` a propósito: la app no tiene
login y el endpoint es público, así que un destinatario que llegara del cliente
convertiría esto en un relay de spam firmado con el dominio de Anceu.

En los logs del Worker queda el id de Resend de cada envío, que es con lo que se
rastrea después un inventario concreto en su panel.
