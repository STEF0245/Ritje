# Ritje Styling Fundamentals

## Theme Identity

- Mood: minimal almost-black interface with clean flat surfaces.
- Primary background: near-black solid background.
- Accent color: blue (`--ride-accent`) used only for high-priority actions.
- Typography style: bold, high-contrast headings with muted supporting text.
- Shape language: low radius (less rounded corners).

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
- `theme-btn-primary`: high-emphasis action button (blue).
- `theme-btn-secondary`: neutral action button (non-blue).
- `theme-pill`: compact low-radius shape for chips/buttons.
- `theme-avatar`: neutral avatar chip.
- `theme-footer-shell`, `theme-footer-link`: footer layout and link styling.
- `theme-border`, `theme-surface`, `theme-hover-accent-border`: reusable border/surface/hover behavior.
- `ride-accent`: legacy class; prefer `theme-btn-primary` for new work.
- `ride-glass`: translucent glass background for header/footer.

## Theme-First Workflow

- Always prefer shared theme classes over inline utility duplication.
- If a style is used in 2+ places, move it into [public/css/tailwind.css](public/css/tailwind.css).
- Update component classes once, then reuse everywhere to avoid repeated edits.
- Keep blue accents limited to `theme-btn-primary` and critical status highlights.
- Prefer semantic classes (`theme-*`) over hardcoded utility colors in templates.

## Alerts

Alerts use [views/partials/notify.ejs](views/partials/notify.ejs) and should always pass:

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
- Keep corners subtle: avoid highly rounded pills unless functionally required.
- Do not add page-specific inline `<style>` unless unavoidable.

## Content Rules

- Use Dutch UI copy consistently.
- Keep action buttons in flat accent style for primary actions.
- Keep secondary links in muted style (`theme-link`).

## Accessibility Notes

- Preserve visible focus states on inputs.
- Keep contrast high for text on dark backgrounds.
- Use semantic headings and `role="alert"` for error messages.
