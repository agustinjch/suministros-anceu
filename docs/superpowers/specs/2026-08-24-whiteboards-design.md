# Weekly whiteboards — design

**Date:** 2026-08-24  
**Status:** Approved for implementation planning

## Purpose

Add two short, independent weekly whiteboard tasks to
`suministros.anceu.com`. Each task guides a person through photographing one
whiteboard, checking that the writing is legible, erasing the board, and
emailing the photo to `hello@anceu.com`.

The tasks replace sending whiteboard photos through Slack, where image quality
can make the writing difficult to read. The email itself is the permanent
record; the application will not create a cloud archive of the images.

## Scope

The app home screen will offer three independent tasks:

1. **Supplies** — the existing inventory-counting flow.
2. **Beverage whiteboard** — photograph, erase, and send the drinks board.
3. **Laundry whiteboard** — photograph, erase, and send the washing-machine
   board.

The two whiteboards are deliberately separate because they are far apart in
the house. Finishing one must not depend on visiting or completing the other.
Each whiteboard produces its own email.

The existing Spanish and English language toggle applies to the new home screen
and both whiteboard flows. The board labels and instructions are translated;
email subjects remain fixed in English for consistent filtering.

## Home screen

The current start screen becomes a task selector with three large,
phone-friendly choices. Selecting Supplies enters the existing flow without
changing its counting, review, or email behaviour. Selecting a whiteboard task
starts a new flow scoped to that board.

The home screen does not show or edit the remembered name; it remains a simple
task selector. Name entry and editing happen inside each task.

## Remembered person

The whiteboard flow requires the name of the person completing the task. The
app stores the last non-empty name in `localStorage`:

- When no name is stored, the task asks for it before continuing.
- When a name is stored, the field is prefilled and remains editable.
- A changed name becomes the remembered name for subsequent tasks.
- Whitespace-only names are invalid. The trimmed name is limited to 80
  characters.

Supplies also uses the remembered name as its initial value, but this feature
must not make the currently optional Supplies name mandatory. Editing a
non-empty name in Supplies updates the remembered name. A successful Supplies
submission must not delete it.

## Whiteboard task flow

Both whiteboard tasks use the same reusable flow with board-specific labels.

### 1. Introduction and name

The first screen identifies the selected board and explains:

- Photograph the board before erasing it.
- Make sure all writing is readable in the photo.
- A blank board still requires a photo.
- Erase the board completely after a valid photo has been captured.

The screen includes the required, prefilled person-name field.

### 2. Photograph

The person can either open the device camera or select an existing image from
the gallery. The app recommends using the phone's normal camera first when
practical, because that leaves an additional copy in the gallery.

After selection, the app prepares a JPEG suitable for email and displays a
large preview. The person can enlarge it to check the writing and can replace
the image. The app must finish processing and locally saving the prepared image
before it allows the person to proceed to erasing the board.

### 3. Erase and confirm

Only after a valid preview exists does the app ask the person to erase the
selected board. An explicit confirmation — “I have erased the whiteboard” — is
required before sending.

This confirmation is a procedural check, not proof from a second photograph.
No after-erasing photo is required.

### 4. Review and send

The final screen shows:

- The selected board.
- The person's name.
- The legible, enlargeable photo preview.
- The completed erasure confirmation.
- An option to replace the photo or edit the name.
- The send button.

The send button remains disabled until the name, valid prepared image, and
erasure confirmation are all present.

### 5. Confirmation

After the server confirms the email, the app deletes that board's local draft
and shows a success message with a route back to the three-task home screen.
Completing one board does not clear or alter a draft for the other board.

## Images and local drafts

### Image preparation

Image preparation happens in the browser before upload:

- Correct the displayed orientation when the browser exposes rotated camera
  pixels.
- Scale down only when the longest edge exceeds 2400 pixels.
- Encode as JPEG at high quality, initially 0.9.
- Enforce a maximum prepared-image size of 5 MB. If necessary, reduce JPEG
  quality in bounded steps while retaining the 2400-pixel dimensions where
  possible.
- Reject files the browser cannot decode and explain that the person should
  choose another image or a JPEG/PNG version.

The exact compression implementation may change during planning, but the
observable requirement is fixed: the prepared image is at most 5 MB, its long
edge is at most 2400 pixels, and the preview must be the same prepared image
that will be attached to the email.

### Draft persistence

`localStorage` is appropriate for the remembered name and lightweight draft
metadata, but not for multi-megabyte image data. Prepared image blobs are saved
in IndexedDB, independently keyed by board type:

- `beverages`
- `laundry`

The associated metadata records the person's name, erasure confirmation, MIME
type, and last-updated time. Reopening a task after a reload restores its draft
and preview. Replacing a photo replaces only that board's stored blob.

Drafts remain on the device after validation, network, or email-provider
errors. A draft is deleted only after a successful server response or an
explicit “discard draft” action confirmed by the person. Successful sends do
not retain cloud or browser copies beyond the email attachment.

## API and validation

Add a dedicated `POST /api/whiteboards` endpoint. The browser sends
`multipart/form-data` containing:

- `board`: exactly `beverages` or `laundry`.
- `completed_by`: a trimmed name from 1 to 80 characters.
- `erased`: exactly `true`.
- `photo`: exactly one JPEG image, no larger than 5 MB.

The Worker rejects a declared `Content-Length` above 6 MB before reading the
form and independently rejects a parsed photo above 5 MB. It validates every
field, rejects unknown or duplicate fields, requires both the `image/jpeg`
MIME type and a JPEG file signature, and never accepts a recipient from the
client. A missing `Content-Length` does not bypass the post-parse 5 MB photo
limit.

The endpoint remains unauthenticated, matching the current Supplies endpoint.
Its abuse surface is constrained through a fixed recipient, strict field and
size validation, and a single image attachment. Rate limiting is not part of
this change; it can be added later if production logs show abuse.

The existing `POST /api/send` Supplies endpoint and its request format remain
unchanged.

## Email format

The Worker sends one plain-text email per completed board through the existing
Resend account and fixed addresses:

- **To:** `hello@anceu.com`
- **From:** `Suministros Anceu <no-reply@send.anceu.com>`

Subjects:

- `[Anceu] Weekly whiteboard — Beverages — YYYY-MM-DD`
- `[Anceu] Weekly whiteboard — Laundry — YYYY-MM-DD`

Body:

```text
Board: Beverages
Completed by: Marta
Completed at: 2026-08-24 18:42 Europe/Madrid
Whiteboard erased: Yes
```

Attachment filenames:

- `beverages-whiteboard-YYYY-MM-DD.jpg`
- `laundry-whiteboard-YYYY-MM-DD.jpg`

Dates and times use `Europe/Madrid`, matching the Supplies report. The Worker
Base64-encodes the validated JPEG for Resend. With one attachment capped at
5 MB, the message remains comfortably below Resend's 40 MB post-Base64 email
limit.

## Failure behaviour

- **Image cannot be decoded:** keep the task open and ask for another image.
- **Image processing or local persistence fails:** do not show the erasure step;
  explain that the photo could not be saved safely.
- **Invalid server request:** show a generic validation message and retain the
  draft.
- **Network or Resend error:** show a retry action and retain the complete
  board draft, including its image and erasure confirmation.
- **Successful email:** clear only the completed board's draft.

The UI must not claim success until Resend has accepted the email. Logs include
the Resend message id and board type but never the person's name or image data.

## Accessibility and mobile behaviour

- All controls have visible text labels; the confirmation is not conveyed by
  colour alone.
- Photo previews include board-specific alternative text.
- Buttons and task cards use touch-friendly targets.
- Progress and errors are announced to assistive technology.
- The preview and controls work on narrow phone screens without horizontal
  scrolling.
- Sending shows an in-progress state and prevents double submission.

## Testing and verification

Automated tests will cover:

- The home screen exposes all three independent tasks.
- Supplies still enters and completes its existing flow.
- A remembered name is restored and edits persist across tasks.
- Whiteboard send is blocked without a name, photo, or erasure confirmation.
- Beverages and laundry drafts are stored and restored independently.
- A failed send preserves the complete draft; a successful send clears only
  the submitted board.
- Image preparation respects maximum dimensions and size, with fixtures for
  landscape and portrait images.
- The Worker rejects invalid board values, missing confirmation, invalid names,
  non-JPEG files, oversized files, and caller-supplied recipients.
- Each board produces the correct subject, body label, and attachment filename.
- Dates around midnight use `Europe/Madrid`.
- Existing Supplies tests continue to pass.

Manual verification on at least one Android browser and one iPhone browser will
check camera capture, gallery selection, readable previews, reload recovery,
retry after a simulated network error, and receipt of both email types in
`hello@anceu.com`.

The repository gates remain:

```bash
npm test
npm run build
```

## Out of scope

- A combined two-whiteboard task or combined email.
- A gallery or history inside the app.
- Cloud storage in R2, KV, D1, Drive, or Slack.
- Optical character recognition or automatic transcription.
- Proof-of-erasure photographs.
- Scheduling, reminders, or tracking whether the weekly task was completed.
- Login or role-based access.
