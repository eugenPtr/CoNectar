# Mobile text entry: five visible lines and a visible caret

## Manual findings (21 October 2026)

Checked the local app in Chrome at a narrow mobile breakpoint, using `/profile/edit` and the test-only `/test/onboarding` flow. No profile or onboarding submission was made.

- Editing an existing 163-character Resource in the profile opens a 44 px, one-row textarea. Its content needs about 160 px, but `overflow-hidden` leaves the first line visible and clips the rest. The same shared Resource editor is used in onboarding.
- After entering a longer Resource description, the textarea grows to its full content height (about 184–208 px in the cases checked). There is no five-line limit.
- Onboarding Passions has a fixed three-row height. After inserting five lines at once, the caret was at the end but `scrollTop` remained zero, so the first three lines were visible. Further character-by-character typing scrolled to the last lines. The existing profile Passions value similarly overflows its three-row box and initially shows the top.
- Project descriptions start at four rows. First and last name, location, project title, contact, and social fields are native one-line inputs. Birthplace is an autocomplete input; phone, email, date, and time have specialized input behavior.

## Proposed behavior

1. Use a shared `AutoGrowingTextarea` for free text in both flows: first and last name, location, Passions, project title and description, and Resource descriptions. Start at one visible line, grow with soft wrapping, and stop at **five visible text lines**. Keep the current minimum 44 px touch target. Permit explicit line breaks in long-form descriptions and Passions; keep names, location, and titles as one logical line while still allowing their text to wrap visually.
2. Once content exceeds five lines, keep the height fixed and allow vertical scrolling inside the field. When inline editing opens with autofocus, put the caret at the end and show the latest line. While typing or pasting at the end, keep the caret and newest line visible with as much preceding text as fits. If the user taps or selects earlier text, preserve that caret position and let them edit there; never force every change to the end.
3. Measure prefilled values as soon as a field opens, including inline Resource edit, restored onboarding drafts, and project edit. Recalculate on value change and viewport/width change so wrapping remains correct after rotation or resize. Clamp height using the computed line height, padding, and borders rather than a hard-coded pixel value. Avoid a visible resize handle on mobile.
4. Keep phone, email, website/social URLs, date/time, and birthplace autocomplete as native specialized inputs. Their keyboard, validation, autofill, and suggestion behavior depends on those controls; multiline content would be invalid. Ensure long values in these controls scroll horizontally to the caret when focused. Revisit this exception only if product wants soft-wrapped display for structured values.
5. Preserve existing field validation, character limits, Resource Enter-to-commit and Shift+Enter behavior, save semantics, labels, and toast feedback. Do not write scrolling or display-only line breaks into saved data.

## Implementation sequence

1. Add the reusable field component and a small sizing/caret helper. Set `height` from `scrollHeight`, bounded by one- and five-line heights. Use `overflow-y: auto` at the cap. After an end-of-text edit, bring the caret into view after React updates the controlled value; avoid resetting the scroll position for edits in the middle.
2. Replace the relevant controls in `app/onboarding/form.tsx`, `components/profile-editor.tsx`, `components/heart-project-editor.tsx`, and `components/resource-editor.tsx`. Remove the Resource editor's current uncapped `grow()` and `overflow-hidden` behavior.
3. Add focused component tests for initial long values, 1→2→5→6 line transitions, soft wrapping, paste, edits in the middle, and the Resource keyboard actions. Keep field validation tests focused on any behavior changed by converting native text inputs.
4. Manually retest onboarding steps 1–3 and 5 and profile editing at narrow phone and desktop widths. Exercise empty, two-line, five-line, and longer text; paste and typing; prefilled Resource/project editing; caret movement to earlier lines; rotation or resize; touch scrolling inside the field; keyboard covering the field; and save/validation states. Verify that the last line stays visible during end-of-text entry and older lines remain reachable by scrolling.

## Acceptance criteria

- Every free-text field listed above shows one to five lines, never hides text from scrolling, and never grows beyond five visible lines.
- A newly opened field containing long text sizes correctly before the user types.
- End-of-text typing and paste keep the caret and latest line visible; editing earlier text does not jump to the bottom.
- Text beyond five lines scrolls smoothly inside the field on mobile, including with the software keyboard open.
- Both onboarding and profile editing retain their current validation, character limits, and persistence behavior.
