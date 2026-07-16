# Colorificio Home CSS Notes

This document records the current home styling in
`components/tools-home.tsx`. It is intentionally more detailed than the page:
the public UI stays terse, while this file explains how to extend it safely.

## Scope

The home is a compact hub for Colorificio media tools:

- active tools: `Static Palette` and `Video Palette`
- locked demo modules: `Image Lab`, `Audio Keys`, `Poster Cut`
- mock WordPress plugin list
- mock Chrome extension list
- static early-access form

Plugin, extension, and registration areas are still demos. They do not install,
submit, persist, or call APIs.

## Route Map

- `/` renders `ToolsHome`
- `/tools/video-palette` renders `VideoPaletteApp`
- `/tools/frame-palette` redirects to `https://static.colorificio.app/`
- `https://static.colorificio.app/` serves the still-image palette generator

The home uses hash anchors only for internal sections:

- `#tools`
- `#wordpress`
- `#extensions`
- `#register`

## Implementation Model

The page is data-driven. Repeated UI is declared near the top of
`components/tools-home.tsx`:

- `tools`: active cards with route targets, including the external static tool
- `upcoming`: locked future modules
- `wordpress`: demo plugin labels
- `chrome`: demo extension labels
- `swatches`: brand color strip

Add future items through these arrays before changing the layout. Keep demo and
live states visually distinct.

## CSS Strategy

Styling uses Tailwind utility classes in the component. The only inline style
block scopes the page background and color-scheme to the home:

```css
html:has(.tools-home-shell),
body:has(.tools-home-shell) {
  background: #f4f0ea;
  color-scheme: light;
}

html.dark:has(.tools-home-shell),
html.dark body:has(.tools-home-shell) {
  background: #13110f;
  color-scheme: dark;
}
```

This keeps screenshots and full-height captures clean in both modes. The real
theme switch is the shared `ThemeToggle`, backed by `next-themes`.

## Visual Tokens

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| Page background | `#f4f0ea` | `#13110f` | Main shell |
| Header surface | `#fbf8f2` | `#15120f` | Sticky top area |
| Card surface | `#fffdf8` | `#181512` | Tools and form |
| Secondary surface | `#f4eee4` | `#211c18` | Icon tiles |
| Primary text | `#241f1a` | `#f4eee5` | Headings |
| Body text | `#4d443b` | `#ded4c7` | Labels and card text |
| Muted text | `#807568` | `#a79b8f` | Badges and helper text |
| Border | `#d8d0c6` | `#302820` | Cards and inputs |
| Primary action | `#453a31` | `#f4eee5` | Buttons |
| Video accent | `#d86b2a` | `#f1a06f` | Video card |
| Frame accent | `#4f7d52` | `#9bc58d` | Frame card |

The palette should stay warm and quiet, with accents used sparingly. Do not turn
the page into a single-hue theme; the swatch strip is the controlled color range.

## Layout

Desktop first viewport:

```txt
left: brand mark, headline, one-line promise, swatches
right: static and video tool cards
below: locked demos, plugin mocks, extension mocks, early access
```

Key layout choices:

- `max-w-6xl` keeps the page airy without stretching cards too wide.
- `px-5 sm:px-8` sets stable gutters.
- `lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)]` balances hero and tools.
- `rounded-lg` is the maximum radius for major panels.
- Cards are not nested inside other cards.

## Typography And Copy

The home copy is deliberately short:

- headline: `Colorificio`
- promise: `Color from film, stills and the web.`
- tool cards: one action line plus one compact descriptor
- demo sections: labels only, no explanatory paragraphs

Hero type uses fixed sizes, never viewport-based scaling. Letter spacing remains
normal to avoid cramped rendering at small widths.

## States

### Header

The header contains the brand link, desktop anchors, preview badge, and shared
light/dark toggle. Navigation hides on smaller screens to preserve space.

### Tool Cards

Active cards are links. They include an icon tile, status badge, concise copy,
and a button-like `Open` affordance. Hover and focus states are visible in both
themes.

### Demo Lists

WordPress and Chrome sections are informational mockups. Lock icons communicate
that the items are not operational yet.

### Registration

The early-access form is static:

- `button` type is `button`
- no `action`
- no server action
- no API call
- no local persistence

When registration becomes real, add validation, success/error states, and a
backend endpoint in the same change.

## Verification Checklist

After meaningful home changes run:

1. `npm run lint`
2. `npm run typecheck -- --incremental false`
3. `npm run build`
4. Browser smoke on `/`
5. Light and dark mode toggle check
6. Desktop and mobile viewport screenshot review
7. Horizontal overflow check
8. Console warning/error check
