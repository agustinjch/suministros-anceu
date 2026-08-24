# Suministros Anceu

A phone-friendly web app for weekly house tasks at [Anceu
Coliving](https://anceu.com). Its home screen offers the Supplies inventory and
two independent whiteboard tasks (beverages and laundry). Every completed task
emails its result to `hello@anceu.com`.

**Live:** [suministros.anceu.com](https://suministros.anceu.com)

<!-- Screenshot: add one of the counting card here once you have it. -->

## Why this exists

Supply stock lived in a Google Sheet where a weekly script *assumed* the last
delivery had restocked the house to target, and copied the target over the
"current amount" column. Nobody ever counted. The error compounded silently:
by the time this app was written, the sheet believed there were 12 packs of
beer against a target of 6, and 23 cartons of milk against a target of 12.

Orders were being placed from a snapshot nobody had verified.

This app replaces the assumption with an actual count. It doesn't write back to
the sheet — the email is the new source of truth, and it's deliberately
formatted so that an AI agent can read it and build the shopping cart.

## Supplies

1. Open the link, optionally type your name.
2. One card per product: photo, name, and a big numeric input. 47 products,
   grouped by area (kitchen → cleaning → food → drinks → coffee bar) so you
   walk the house once instead of doubling back.
3. **Skip** is explicit and recorded as *not counted*, never as zero. "There are
   none left" and "I didn't look" must not arrive looking the same.
4. Review everything, then send.

Counts are written to `localStorage` on every keystroke and only cleared once
the email provider confirms. Somebody will lock their phone at item 20, and
they will not start over.

**Counters never see the target.** It's hidden from the card and from the review
screen — including any highlighting that would reveal being under target — so
nobody nudges a number toward the expected answer.

## Weekly whiteboards

The beverage and laundry boards are separate tasks because they are in
different parts of the house. Each task asks who completed it, prepares one
camera or gallery image as a legible JPEG (up to 2400 px and 5 MB), and shows
the exact image that will be emailed. Only after that image is safely stored
does the app ask the person to erase the board and confirm they have done so.

Each board draft lives independently in the browser's IndexedDB. A reload,
network error, or email-provider failure keeps the photo and erasure
confirmation available for retry. The local draft is deleted only after
Resend accepts the email; there is no cloud image archive.

The last non-empty person's name is kept separately in `localStorage`,
prefilled in all three tasks, and remains editable. Whiteboard emails are sent
independently with one JPEG attachment:

```text
[Anceu] Weekly whiteboard — Beverages — 2026-08-24
[Anceu] Weekly whiteboard — Laundry — 2026-08-24
```

## The email

Plain text, in English, fixed columns. No HTML: an AI agent parses this to build
the Froiz order, and plain text has nothing to break.

```
Subject: [Anceu] Supplies — 7 to buy (2026-08-01)

Counted by: Bartek — 2026-08-01 18:42

TO BUY (7)
Papel de cocina         have 4    should be 7   buy 3 ud    https://supermercado.froiz.com/product/38762-...
Lejía con detergente    have 2    should be 5   buy 3 ud    https://supermercado.froiz.com/product/4976-...

FULL INVENTORY (44 counted)
Papel higiénico         have 3    should be 3   OK
Papel de cocina         have 4    should be 7

NOT COUNTED (2)
Estropajos
Bolsas de basura 100 L
```

`FULL INVENTORY` exists for one concrete reason, not completeness: without it
you cannot tell "there's plenty" from "they skipped that card". Both produce
silence in `TO BUY`. The three sections never overlap and always sum to the
catalogue.

Timestamps are computed in `Europe/Madrid`, not UTC — Workers run in UTC, and a
count at 00:30 would otherwise be dated the previous day, in the subject line.

## Stack

React 19 + Vite 8 + TypeScript, served by a single Cloudflare Worker that
handles `POST /api/send` for Supplies and `POST /api/whiteboards` for a strict
multipart JPEG submission. Email goes out through [Resend](https://resend.com).

No server-side database. The catalogue is a JSON file in the repo; counts live
in localStorage and temporary whiteboard drafts live in IndexedDB.

All the real logic sits in `src/lib/` as pure functions so it can be tested
without a browser. Components and the Worker are thin layers on top.

```
src/lib/shortfall.ts   max(0, target − have), and the not-counted rule
src/lib/email.ts       Report → subject and body
src/lib/i18n.ts        Spanish (default) / English
src/lib/storage.ts     localStorage session
src/products.json      generated catalogue — do not hand-edit
public/img/            product photos, downloaded from Froiz
worker/index.ts        routing + Resend call
worker/validate.ts     request validation (pure, separately tested)
worker/whiteboards.ts  whiteboard validation + email formatting
scripts/seed.tsv       the catalogue's human-authored source
```

## Development

```bash
npm install
npm run dev      # SPA + Worker together, http://localhost:5173
npm test         # automated test suite
npm run build    # tsc --noEmit + vite build
```

To exercise real sending locally, create `.dev.vars` (git-ignored):

```
RESEND_API_KEY=re_...
```

Without it the endpoint returns 500, which is a fine way to test the retry path.

## Adding or changing a product

`src/products.json` is generated. Edit `scripts/seed.tsv` instead — columns are
`id`, `zone`, `target`, `unit`, `name`, `name_en`.

```bash
npm run add -- <froiz-url> <zone> <target> <unit> "<spanish name>" "<english name>"
# move the new line into its zone block, then:
npm run catalog
```

`npm run catalog` calls Froiz's public catalogue API
(`GET https://servicios.froiz.com/api/products/{id}`, no auth required), writes
`src/products.json`, and downloads photos to `public/img/`.

Three things worth knowing before you touch this:

**The unit is a human decision, not an API field.** Froiz returns
`measurement_unit: "Unidad"` for multipacks too. Trusting it would make the app
count Estrella Galicia in bottles instead of 12-bottle packs, and the order
would come out twelve times short. The unit lives in `seed.tsv`; the build
script only warns about mismatches.

**Photos are downloaded, not hot-linked.** Froiz serves images from a signed URL
with an expiry. Today the signature isn't enforced, so the unsigned URL works —
which means it works by accident. If Froiz ever turns enforcement on, all 47
cards would lose their photos silently, mid-count. All 47 images together are
about 560 KB.

**Products get discontinued without warning.** Two of the original catalogue already
had dead links. `npm run catalog` walks all products even when some fail, lists
everything broken at the end, and refuses to write `products.json` if anything
did — a silently short catalogue is worse than none. A 404 almost always means
the product was withdrawn; find a replacement with
`https://servicios.froiz.com/api/products?term=<text>`.

## Deployment

```bash
npx wrangler login                       # once
npx wrangler secret put RESEND_API_KEY   # once
npm run deploy
```

The sender is `no-reply@send.anceu.com` — a dedicated subdomain verified in
Resend specifically so that verifying it never touches the MX records of
`anceu.com` itself.

## Security notes

The app has no login. It's a link that isn't published anywhere, and the worst
case is a bogus inventory that's obvious on reading. That choice has two
consequences the code takes seriously:

- **The recipient is hardcoded** in `worker/index.ts`. It never comes from the
  request body. A public endpoint with a caller-supplied recipient is an open
  spam relay signed with someone else's domain. There's a test that posts a
  `to` field and asserts it's ignored.
- **The Resend API key is a Worker secret**, never in the bundle. That's the
  entire reason the endpoint exists rather than calling Resend from the browser.

Request bodies are validated: unknown product ids, duplicates, non-integer or
out-of-range amounts and oversized payloads are all rejected before anything is
sent. Provider errors are logged server-side and reported to the client as a
generic 502.

Each successful send logs its Resend id, which is the only way to trace a
specific inventory afterwards in Resend's dashboard.

## Design documents

The reasoning behind the decisions above, written before the code:

- [Design](docs/superpowers/specs/2026-07-31-suministros-anceu-design.md)
- [Implementation plan](docs/superpowers/plans/2026-07-31-suministros-anceu.md),
  including the eight things the plan got wrong and how they were fixed.

## Reusing this

It's a small, specific tool, but the shape generalises to any "walk around and
count things, then email a shortfall report" problem — a makerspace, a bar
cellar, a school supply cupboard. What you'd need to change: `scripts/seed.tsv`
(your items), the product API in `scripts/froiz.ts` (your supplier, or drop it
and hand-write the catalogue), and the recipient in `worker/index.ts`.

MIT licensed — do what you like with it, just keep the attribution. See
[LICENSE](LICENSE).
