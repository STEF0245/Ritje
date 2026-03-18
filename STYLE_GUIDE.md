# Ritje Styling Fundamentals

## Theme Identity

- Mood: modern dark interface with clean flat surfaces.
- Primary background: deep slate solid background.
- Accent color: teal (`--ride-accent`), with soft teal for labels (`--ride-accent-soft`).
- Typography style: bold, high-contrast headings with muted supporting text.

## Design Tokens

These tokens are defined in [public/css/tailwind.css](public/css/tailwind.css):

- `--ride-bg-900`, `--ride-bg-800`, `--ride-bg-700`
- `--ride-border`
- `--ride-text`, `--ride-muted`
- `--ride-accent`, `--ride-accent-soft`

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
- Do not add page-specific inline `<style>` unless unavoidable.

## Content Rules

- Use Dutch UI copy consistently.
- Keep action buttons in flat accent style for primary actions.
- Keep secondary links in muted style (`theme-link`).

## Accessibility Notes

- Preserve visible focus states on inputs.
- Keep contrast high for text on dark backgrounds.
- Use semantic headings and `role="alert"` for error messages.
