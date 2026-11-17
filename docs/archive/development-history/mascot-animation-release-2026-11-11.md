# Mascot animation release — 2026-11-11

## Scope

This release introduces the rectangular-headed Bookworm mascot to the live product experience. It is intentionally limited to mascot presentation, rating reactions, the guest homepage welcome sequence, and the runtime sprite assets required by those interfaces.

## Guest homepage

- Replaced the generic guest hero mascot treatment with a one-shot welcome sequence.
- The worm keeps a fixed body and only changes its face or blinks.
- After a one-second delay, the mouth changes to a toothy smile and a UI speech bubble says `Welcome!`.
- The mouth returns to its basic smile as the first bubble fades out.
- A second UI speech bubble fades in with `Ready to get started?`, then fades away.
- Once the welcome sequence finishes, the worm remains still and occasionally blinks.
- Added a reduced-motion state that avoids the one-shot facial sequence and presents a stable greeting.

## Title rating experience

- Replaced the generic ten-star row with an explicit 1–10 numeric score rail.
- Added clear hover, focus, selected, pressed, and keyboard-accessible radio states.
- Added a live score readout and qualitative score labels.
- Integrated the five looping rating reactions:
  - `1–2`: recoils, stays lowered, and alternates its gaze.
  - `3–4`: sleeps with outlined `Z` marks.
  - `5–6`: loops a restrained approving nod.
  - `7–8`: whistles with a musical note that travels outward, holds, and disappears without retracting.
  - `9–10`: uses the excited celebration loop.
- Added reusable UI speech annotations for each rating band.
- Added a responsive mobile presentation with two rows of five scores and a stacked mascot stage.
- Removed the nested-card treatment from the review composer.

## Sprite and presentation details

- Added neutral and seven canon-colour atlas variants for idle, excited, and rating states.
- Preserved white eyes, teeth, note fills, and `Z` fills during body recolouring.
- Cleaned camera-facing pupils and removed bright background-edge residue.
- Added a stationary toothy frame specifically for the guest welcome sequence.
- Speech bubbles are rendered as reusable interface elements rather than baked into sprite artwork.

## Verification

- Visually checked the guest sequence in the local application.
- Visually checked rating states at desktop and mobile breakpoints.
- Audited runtime atlases for binary alpha and bright transparent-edge residue.
- Passed targeted ESLint checks.
- Passed `tsc --noEmit`.
- Passed the optimized Next.js production build.

## Runtime files

- `components/mascot/`
- `components/review-form.tsx`
- `components/review-form.module.css`
- `app/page.tsx`
- `public/mascot/idle-v6/atlas*.webp`
- `public/mascot/excited/atlas*.webp`
- `public/mascot/rating-emotes/**/atlas*.webp`
- `public/mascot/welcome/toothy.png`
