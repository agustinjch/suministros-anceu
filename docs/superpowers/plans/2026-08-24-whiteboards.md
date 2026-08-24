# Weekly Whiteboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent beverage and laundry whiteboard photo tasks to `suministros.anceu.com`, each sending one recoverable, legible JPEG by email after an explicit erasure confirmation.

**Architecture:** Keep Supplies unchanged behind a new three-task home screen. A reusable whiteboard screen owns the short UI state machine, delegates image preparation to a browser utility, persists each board draft in IndexedDB, and posts a strict multipart form to a dedicated Worker endpoint. The Worker validates one JPEG and sends it as a Base64 Resend attachment to the fixed Anceu inbox.

**Tech Stack:** React 19, TypeScript 7, browser Canvas/IndexedDB APIs, Cloudflare Worker, Resend HTTP API, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-24-whiteboards-design.md`

## Global Constraints

- Keep `POST /api/send` and the existing Supplies counting/review/email behaviour compatible.
- Home choices are Supplies, Beverage whiteboard, and Laundry whiteboard in Spanish and English.
- Whiteboard name is required, trimmed, and at most 80 characters; remember the last non-empty name in `localStorage` and prefill all tasks.
- Accept camera capture or gallery selection; prepare exactly one JPEG with longest edge at most 2400 px and size at most 5 MB.
- Persist beverage and laundry drafts independently in IndexedDB until successful email or confirmed discard.
- Require an explicit erasure confirmation after a valid image has been prepared and saved.
- Send one independent email per board to fixed recipient `hello@anceu.com`; do not add cloud image storage.
- Use `Europe/Madrid` for subject dates and body timestamps.
- Keep email subjects in English and all user-facing app copy bilingual.
- Run `npm test` and `npm run build` before completion.

---

## File map

- Create `src/lib/whiteboards.ts`: board types/configuration plus remembered-name helpers.
- Create `src/lib/whiteboards.test.ts`: configuration and remembered-name tests.
- Create `src/lib/image.ts`: injectable browser image decoding/scaling/JPEG preparation.
- Create `src/lib/image.test.ts`: dimension, quality fallback, and invalid-image tests.
- Create `src/lib/whiteboard-drafts.ts`: IndexedDB CRUD for independent photo drafts.
- Create `src/lib/whiteboard-drafts.test.ts`: persistence, isolation, replacement, and clearing tests.
- Create `src/screens/Home.tsx`: three-task selector.
- Create `src/screens/Home.test.tsx`: selector labels and callbacks.
- Create `src/screens/Whiteboard.tsx`: reusable board-specific task state machine.
- Create `src/screens/Whiteboard.test.tsx`: required fields, resume, failure, and send behaviour.
- Create `src/screens/WhiteboardSent.tsx`: board-specific success screen.
- Modify `src/App.tsx`: route among home, existing Supplies screens, whiteboard tasks, and success.
- Create `src/App.test.tsx`: home routing and Supplies regression tests.
- Modify `src/screens/Sent.tsx`: add a route back to the new task selector.
- Modify `src/lib/i18n.ts`: all home and whiteboard Spanish/English strings.
- Modify `src/lib/storage.ts`: seed and update the remembered name without coupling it to the Supplies session lifecycle.
- Modify `src/lib/storage.test.ts`: Supplies integration with remembered name.
- Modify `src/styles.css`: task cards, instructions, preview, checkbox, progress, and responsive states.
- Create `worker/whiteboards.ts`: pure multipart validation metadata, JPEG signature check, email formatting, and Base64 conversion.
- Create `worker/whiteboards.test.ts`: validation and deterministic email-format tests.
- Modify `worker/index.ts`: `/api/whiteboards` route and Resend attachment send.
- Modify `worker/index.test.ts`: endpoint routing, fixed recipient, attachment, limits, and provider failures.
- Modify `README.md`: document three tasks, draft persistence, endpoint, and email formats.

---

### Task 1: Whiteboard domain and remembered person

**Files:**
- Create: `src/lib/whiteboards.ts`
- Create: `src/lib/whiteboards.test.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.test.ts`

**Interfaces:**
- Produces: `type WhiteboardType = 'beverages' | 'laundry'`.
- Produces: `WHITEBOARDS: Record<WhiteboardType, { emailLabel: string; filename: string }>`.
- Produces: `loadRememberedName(): string` and `saveRememberedName(name: string): void`.
- Existing `loadSession`, `saveSession`, and `clearSession` remain compatible.

- [ ] **Step 1: Write failing domain and storage tests**

```ts
expect(WHITEBOARDS.beverages.emailLabel).toBe('Beverages')
expect(WHITEBOARDS.laundry.filename).toBe('laundry-whiteboard')

localStorage.setItem('suministros-anceu:person-name', '  Marta  ')
expect(loadRememberedName()).toBe('Marta')
saveRememberedName('  Brais  ')
expect(localStorage.getItem('suministros-anceu:person-name')).toBe('Brais')
clearSession()
expect(loadRememberedName()).toBe('Brais')
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- src/lib/whiteboards.test.ts src/lib/storage.test.ts`
Expected: FAIL because the whiteboard module and remembered-name helpers do not exist.

- [ ] **Step 3: Implement the domain configuration and safe localStorage helpers**

```ts
export type WhiteboardType = 'beverages' | 'laundry'

export const WHITEBOARDS = {
  beverages: { emailLabel: 'Beverages', filename: 'beverages-whiteboard' },
  laundry: { emailLabel: 'Laundry', filename: 'laundry-whiteboard' },
} as const satisfies Record<WhiteboardType, { emailLabel: string; filename: string }>
```

Use `suministros-anceu:person-name`, trim on read/write, cap at 80 characters,
ignore blank writes, and catch storage exceptions. Keep the key separate from
`suministros-anceu:session`, so `clearSession()` cannot remove it.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/whiteboards.test.ts src/lib/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboards.ts src/lib/whiteboards.test.ts src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: remember whiteboard task owner"
```

---

### Task 2: Browser image preparation

**Files:**
- Create: `src/lib/image.ts`
- Create: `src/lib/image.test.ts`

**Interfaces:**
- Produces: `prepareWhiteboardImage(file: File, browser?: ImageBrowser): Promise<Blob>`.
- Produces: `ImagePreparationError` with codes `decode`, `canvas`, and `too-large`.
- Guarantees returned blob type `image/jpeg`, maximum longest edge 2400 px, maximum size 5 MB.

- [ ] **Step 1: Write failing tests with an injected fake browser adapter**

```ts
const browser = fakeBrowser({ width: 4000, height: 3000, sizes: [6_000_000, 4_500_000] })
const result = await prepareWhiteboardImage(new File(['x'], 'board.png'), browser)
expect(browser.drawnDimensions).toEqual({ width: 2400, height: 1800 })
expect(browser.qualities).toEqual([0.9, 0.82])
expect(result.type).toBe('image/jpeg')
expect(result.size).toBeLessThanOrEqual(5_000_000)
```

Also test portrait scaling, no upscale for small images, decode rejection, null
canvas blobs, and exhaustion of bounded quality attempts.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/lib/image.test.ts`
Expected: FAIL because `prepareWhiteboardImage` does not exist.

- [ ] **Step 3: Implement an injectable Canvas pipeline**

Define the default adapter around `createImageBitmap`, `document.createElement('canvas')`,
`drawImage`, and `canvas.toBlob`. Compute dimensions with:

```ts
const scale = Math.min(1, 2400 / Math.max(width, height))
const output = {
  width: Math.max(1, Math.round(width * scale)),
  height: Math.max(1, Math.round(height * scale)),
}
```

Try JPEG qualities `[0.9, 0.82, 0.74, 0.66]`, returning the first blob at or
below 5,000,000 bytes. Revoke/close decoded resources in `finally`. Throw a
typed error when decoding or encoding fails or all attempts remain oversized.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/image.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/image.ts src/lib/image.test.ts
git commit -m "feat: prepare legible whiteboard photos"
```

---

### Task 3: Recoverable, independent IndexedDB drafts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/whiteboard-drafts.ts`
- Create: `src/lib/whiteboard-drafts.test.ts`

**Interfaces:**
- Consumes: `WhiteboardType` from `src/lib/whiteboards.ts`.
- Produces: `interface WhiteboardDraft { board; completedBy; erased; photo; updatedAt }`.
- Produces: `loadWhiteboardDraft(board)`, `saveWhiteboardDraft(draft)`, and `clearWhiteboardDraft(board)`.

- [ ] **Step 1: Add the IndexedDB test runtime**

Run: `npm install --save-dev fake-indexeddb`
Expected: `package.json` and `package-lock.json` record the dev dependency.

- [ ] **Step 2: Write failing persistence tests**

```ts
await saveWhiteboardDraft({
  board: 'beverages', completedBy: 'Marta', erased: true,
  photo: new Blob(['jpeg'], { type: 'image/jpeg' }), updatedAt: 123,
})
expect((await loadWhiteboardDraft('beverages'))?.completedBy).toBe('Marta')
expect(await loadWhiteboardDraft('laundry')).toBeNull()
await clearWhiteboardDraft('beverages')
expect(await loadWhiteboardDraft('beverages')).toBeNull()
```

Add tests for replacing one board without changing the other and graceful
rejection when IndexedDB cannot open or transact.

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- src/lib/whiteboard-drafts.test.ts`
Expected: FAIL because the draft module does not exist.

- [ ] **Step 4: Implement one database and one object store keyed by board**

Use database `suministros-anceu`, version `1`, store `whiteboard-drafts`, and
`keyPath: 'board'`. Wrap request and transaction events in Promises. Validate
loaded records: known board, non-empty capped name, boolean erased, JPEG Blob,
and finite timestamp. Delete malformed records and return `null`.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/lib/whiteboard-drafts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/whiteboard-drafts.ts src/lib/whiteboard-drafts.test.ts
git commit -m "feat: persist whiteboard photo drafts"
```

---

### Task 4: Three-task home and reusable whiteboard UI

**Files:**
- Create: `src/screens/Home.tsx`
- Create: `src/screens/Home.test.tsx`
- Create: `src/screens/Whiteboard.tsx`
- Create: `src/screens/Whiteboard.test.tsx`
- Create: `src/screens/WhiteboardSent.tsx`
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`
- Modify: `src/screens/Sent.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/i18n.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `WhiteboardType`, `prepareWhiteboardImage`, remembered-name helpers, and draft CRUD.
- Produces: `Home({ lang, onSupplies, onWhiteboard })`.
- Produces: `Whiteboard({ board, lang, onHome, onSent })`.
- App screen union becomes `home | supplies-start | count | review | supplies-sent | whiteboard | whiteboard-sent` with the selected board held separately.

- [ ] **Step 1: Add bilingual strings and failing translation tests**

Add exact copy for the three task labels, introduction, name requirement,
camera/gallery input, processing, preview, replace, erase instruction and
confirmation, review, discard, sending, retry, success, and home action. Test
representative Spanish and English strings through `t(lang)`.

Run: `npm test -- src/lib/i18n.test.ts`
Expected: FAIL until the new `Strings` fields and translations exist.

- [ ] **Step 2: Implement translations and run their tests**

Run: `npm test -- src/lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 3: Write failing Home tests**

```tsx
render(<Home lang="es" onSupplies={onSupplies} onWhiteboard={onWhiteboard} />)
screen.getByRole('button', { name: /Suministros/ }).click()
screen.getByRole('button', { name: /Pizarra de bebidas/ }).click()
screen.getByRole('button', { name: /Pizarra de lavandería/ }).click()
expect(onSupplies).toHaveBeenCalledOnce()
expect(onWhiteboard).toHaveBeenNthCalledWith(1, 'beverages')
expect(onWhiteboard).toHaveBeenNthCalledWith(2, 'laundry')
```

- [ ] **Step 4: Implement Home and run its tests**

Run: `npm test -- src/screens/Home.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write failing Whiteboard component tests**

Inject image preparation and draft persistence through optional dependency
props so tests remain deterministic. Cover:

```ts
expect(sendButton).toHaveProperty('disabled', true) // no name/photo/erasure
fireEvent.change(nameInput, { target: { value: 'Marta' } })
fireEvent.change(fileInput, { target: { files: [photo] } })
await screen.findByAltText(/pizarra de bebidas/i)
expect(screen.queryByText(/borra ahora/i)).toBeDefined()
fireEvent.click(screen.getByRole('checkbox'))
expect(sendButton).toHaveProperty('disabled', false)
```

Also cover restored drafts, replacement resetting `erased` to false, processing
failure before erase is offered, failed fetch retaining the draft, successful
fetch clearing only the current draft, `FormData` values, and success callback.
Render separate “Take photo” and “Choose from gallery” controls: the first file
input has `accept="image/*" capture="environment"`; the second has only
`accept="image/*"`, so gallery selection always remains available. Make the
preview a link to its object URL so it can be opened at full size.

- [ ] **Step 6: Implement the Whiteboard state machine and success screen**

Use these observable stages, derived from data rather than persisted as a free
string: introduction/name, photo selection/processing, erase confirmation,
review/send, and success. Create/revoke preview object URLs in effects. Save
after name changes, prepared image success, and erasure changes. POST to
`/api/whiteboards`; never clear on non-2xx or thrown fetch.

- [ ] **Step 7: Integrate App routing and remembered name into Supplies**

Start on `home`. Entering Supplies shows the existing `Start`; its initial name
comes from the remembered-name helper when there is no saved Supplies session.
Persist non-empty Supplies name edits to both the session and remembered-name
key. Add `onHome` to `Sent` so existing Supplies success returns to the task
selector. Add `App.test.tsx` coverage that each home choice opens the correct
flow and that returning home does not mutate a saved Supplies session.

- [ ] **Step 8: Add mobile/accessibility styles**

Add `.task-grid`, `.task-button`, `.instructions`, `.photo-picker`,
`.photo-preview`, `.confirmation`, `.status`, and `.success-actions`. Ensure
44 px minimum controls, full-width previews with `object-fit: contain`, visible
focus, no horizontal scrolling, and `aria-live` for processing/errors.

- [ ] **Step 9: Run UI and existing regression tests**

Run: `npm test -- src/App.test.tsx src/screens/Home.test.tsx src/screens/Whiteboard.test.tsx src/screens/Count.test.tsx src/screens/Review.test.tsx src/lib/i18n.test.ts src/lib/storage.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/lib/i18n.ts src/lib/i18n.test.ts src/styles.css src/screens/Home.tsx src/screens/Home.test.tsx src/screens/Whiteboard.tsx src/screens/Whiteboard.test.tsx src/screens/WhiteboardSent.tsx src/screens/Sent.tsx src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add independent whiteboard tasks"
```

---

### Task 5: Strict Worker validation and whiteboard emails

**Files:**
- Create: `worker/whiteboards.ts`
- Create: `worker/whiteboards.test.ts`
- Modify: `worker/index.ts`
- Modify: `worker/index.test.ts`

**Interfaces:**
- Consumes: `WhiteboardType` configuration without importing browser-only code.
- Produces: `parseWhiteboardForm(form: FormData): WhiteboardSubmission`.
- Produces: `buildWhiteboardEmail(submission, now): { subject; text; filename }`.
- Produces: `bytesToBase64(bytes: Uint8Array): string`.
- Worker adds `POST /api/whiteboards`; other methods return 405 with `Allow: POST`.

- [ ] **Step 1: Write failing pure validation and formatting tests**

Build real `FormData` instances and assert acceptance only for:

```ts
{
  board: 'beverages',
  completedBy: 'Marta',
  erased: true,
  photo: File(['\xff\xd8\xff...'], 'board.jpg', { type: 'image/jpeg' }),
}
```

Test both board values; blank/over-80 names; `erased !== 'true'`; missing,
duplicate, non-JPEG, bad-signature, and >5,000,000-byte photos; unknown fields;
Madrid date rollover; exact subjects, bodies, filenames; and Base64 output.

- [ ] **Step 2: Run pure Worker tests and verify failure**

Run: `npm test -- worker/whiteboards.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure validation and email construction**

Require exact field names `board`, `completed_by`, `erased`, `photo`; use
`form.getAll()` to detect duplicates. Read the first three bytes of the File and
require `ff d8 ff`. Format Madrid parts with `Intl.DateTimeFormat` and stable
`formatToParts`, matching the existing Supplies date conventions.

- [ ] **Step 4: Run pure tests**

Run: `npm test -- worker/whiteboards.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing endpoint tests**

Add a multipart request helper and assert:

- POST sends to the fixed addresses with a single Base64 attachment.
- The subject/body/filename match the selected board.
- A caller-supplied `to` field yields 400 and never changes the recipient.
- Declared `Content-Length > 6_000_000` yields 413 before form parsing.
- Invalid form yields 400 without calling Resend.
- Missing API key yields 500; Resend failure yields generic 502.
- GET yields 405; Supplies endpoint tests remain unchanged.

- [ ] **Step 6: Implement `/api/whiteboards`**

Check API key, method, declared size, and multipart content type. Parse and
validate the form, convert the photo bytes to Base64, and call the existing
Resend endpoint with:

```ts
{
  from: FROM,
  to: [TO],
  subject,
  text,
  attachments: [{ content: base64, filename }],
}
```

Log only Resend id and board. Return `{ ok: true }` after Resend acceptance.

- [ ] **Step 7: Run all Worker tests**

Run: `npm test -- worker/whiteboards.test.ts worker/index.test.ts worker/validate.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add worker/whiteboards.ts worker/whiteboards.test.ts worker/index.ts worker/index.test.ts
git commit -m "feat: email whiteboard photo attachments"
```

---

### Task 6: Documentation and end-to-end verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes the completed browser and Worker flows; produces no new runtime API.

- [ ] **Step 1: Update README user and architecture documentation**

Replace the single-flow description with the three home tasks. Document the
two independent email subjects, local-only IndexedDB draft recovery, 2400 px /
5 MB preparation, `POST /api/whiteboards`, fixed recipient, and that successful
sends delete the browser draft.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`
Expected: all tests PASS with no unhandled rejections.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: TypeScript and Vite complete successfully.

- [ ] **Step 4: Inspect the production bundle and repository diff**

Run: `git diff --check && git status --short && git diff --stat HEAD~4`
Expected: no whitespace errors; only planned files are changed.

- [ ] **Step 5: Perform browser smoke checks where locally available**

Verify Spanish/English home labels, each task's photo preview and erasure gate,
reload recovery, independent drafts, simulated send failure/retry, and Supplies
regression. Record iPhone/Android real-device email receipt as a deployment
verification item if those devices are not attached to the development host.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md
git commit -m "docs: explain weekly whiteboard tasks"
```

- [ ] **Step 7: Final verification after the last commit**

Run: `npm test && npm run build && git status --short`
Expected: tests and build pass; working tree is clean.
