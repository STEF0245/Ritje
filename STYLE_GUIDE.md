# Ritje Styling Fundamentals

## Theme Identity

- Mood: minimal almost-black interface with clean flat surfaces.
- Primary background: near-black solid background.
- Accent color: blue (`--ride-accent`).
- Typography style: bold, high-contrast headings with muted supporting text.

## Design Tokens

These tokens are defined in [public/css/tailwind.css](public/css/tailwind.css):

- Base palette (5 colors only):
- `--ride-c1`: near-black
- `--ride-c2`: dark mid tone
- `--ride-c3`: medium mid tone
- `--ride-c4`: near-white
- `--ride-c5`: blue accent

Semantic aliases are mapped from the 5 base colors for maintainability.

## Reusable Theme Classes

Use these classes before adding custom styling:

- `theme-body`: page background and default text color.
- `theme-main`: consistent vertical page spacing.
- `theme-kicker`: small uppercase section label.
- `theme-heading`: primary page heading style.
- `theme-subtext`: supporting descriptive text.
- `theme-panel`: glass-like content card with border and shadow.
- `theme-input`: standard form field style.
- `theme-link`: subtle link with consistent hover behavior.
- `ride-accent`: accent button/avatar fill (legacy class name, now flat color).
- `ride-glass`: translucent glass background for header/footer.

## Alerts

Alerts use [views/partials/auth_error.ejs](views/partials/auth_error.ejs) and should always pass:

- `authErrorReason`
- `authErrorType` (`error`, `warning`, `info`)

Color mapping:

- `error`: red tones
- `warning`: amber tones
- `info`: sky tones

## Layout Rules

- Use `theme-body` on every page body.
- Keep page content inside a centered section (`max-w-*` + `mx-auto`).
- Wrap cards/forms in `theme-panel` for visual consistency.
- Keep effects minimal: no page accents and no heavy visual effects.
- Do not use pure white (`#ffffff`) or pure black (`#000000`). Use near variants from the palette.
- Do not add page-specific inline `<style>` unless unavoidable.

## Content Rules

- Use Dutch UI copy consistently.
- Keep action buttons in flat accent style for primary actions.
- Keep secondary links in muted style (`theme-link`).

## Accessibility Notes

- Preserve visible focus states on inputs.
- Keep contrast high for text on dark backgrounds.
- Use semantic headings and `role="alert"` for error messages.
