# VAC Tools Home CSS Notes

This document records the structure and styling decisions for the current home
mockup in `components/tools-home.tsx`.

## Scope

The home is a product hub for media-related modules:

- two active tool cards: `Video Palette` and `Frame Palette`
- future media tools: `Image Lab`, `Audio Keys`, `Poster Cut`
- demo WordPress plugin cards
- demo Chrome extension cards
- static demo registration form

The WordPress plugins, Chrome extensions, and registration form are non-operational
mockups. They define the product surface before API, authentication, install
packages, and persistence are added.

## Route Map

- `/` renders `ToolsHome`
- `/tools/video-palette` renders `VideoPaletteApp`
- `/tools/frame-palette` renders `VideoPaletteApp` with a frame-specific title
  and subtitle

The home uses hash anchors for internal navigation:

- `#tools`
- `#wordpress`
- `#extensions`
- `#register`

## Implementation Model

The page is intentionally data-driven. The repeated visual groups are declared
as arrays near the top of `components/tools-home.tsx`:

- `tools`: active first-class tools with real route targets
- `upcomingTools`: locked media modules
- `infoCards`: explanatory cards
- `wordpressPlugins`: WordPress plugin mockups
- `chromeExtensions`: Chrome extension mockups

To add another card of the same type, add an object to the relevant array and
reuse the existing fields: `title`, `description`, `href` when applicable,
`icon`, `accent`, and `iconBg`.

## CSS Strategy

The component uses Tailwind utility classes directly rather than a separate CSS
module. This keeps the small hub page self-contained and makes each section easy
to scan without chasing custom selectors.

The only inline `<style>` block is page-level containment:

```css
html:has(.tools-home-shell),
body:has(.tools-home-shell) {
  background: #f0eeec;
  color-scheme: light;
}
```

That rule prevents the global dark body background from leaking around full-page
captures and browser screenshots. Keep it in place unless the global app theme
is changed to support this page natively.

## Visual Tokens

The palette is adapted from the Fila7-style warm, quiet product surface:

| Token | Value | Usage |
| --- | --- | --- |
| Page background | `#f0eeec` | Main shell background |
| Header wash | `#f8f7f5` | Header and secondary surfaces |
| Card surface | `#fdfcfa` | Active cards and form panel |
| Primary text | `#251f1b` | Headings, brand, main labels |
| Body text | `#665f57` | Descriptions and supporting copy |
| Muted text | `#7b746d`, `#8a837c`, `#9a928a` | Captions, locked states, badges |
| Border | `#d7d2cc`, `#ded8d1`, `#e2ddd7` | Cards, fields, section dividers |
| Primary button | `#4b4138` | Main `Open tool` and demo register button |
| Button hover | `#332b25` | Primary button hover |
| Focus ring | `#5b524a` | Keyboard focus on tool cards |
| Success accent | `#4f8739`, `#48a34a` | Frame card and demo status |
| Video accent | `#e46f17` | Video Palette card |
| Extension accent | `#4c78a8` | Chrome extension cards |

Avoid adding a dominant new hue unless it represents a new product category.
New categories should introduce small accent colors in icons or badges, while
the page background, text, borders, and surfaces remain stable.

## Layout

The first viewport is a two-column product hub on desktop:

```txt
left:  hero copy and short product note
right: active tool cards
below: info cards, upcoming tools, plugin mocks, extension mocks, registration
```

Key container classes:

- `max-w-7xl`: central content width
- `px-5 sm:px-8`: mobile and desktop gutters
- `lg:grid-cols-[minmax(0,0.82fr)_minmax(560px,1.18fr)]`: first viewport
  balance between editorial copy and tool cards
- `md:grid-cols-2`, `md:grid-cols-3`, `lg:grid-cols-3`: progressive card grids

Cards use `rounded-lg`, but the visual radius stays modest. Do not nest cards
inside cards; framed panels are used only for repeated items and the registration
mockup.

## Typography

The page uses the app font stack inherited from the Next/Tailwind setup.

Important sizes:

- hero headline: `text-[42px] sm:text-[58px] lg:text-[62px]`
- primary card title: `text-[31px]`
- section heading: `text-[30px]`
- info card heading: `text-[18px]`
- body copy: `text-[15px]` to `text-[20px]` depending on hierarchy
- labels and badges: `text-[12px]` to `text-[14px]`

Letter spacing remains normal. Do not introduce negative tracking; it makes the
compact product UI less predictable across breakpoints.

## Components And States

### Header

The header has:

- brand link back to `/`
- desktop-only anchor navigation
- `Demo mode` status badge
- static theme-preview icon button

The theme button does not toggle state yet. If a real theme switch is added,
wire it to the existing app theme system instead of local component state.

### Active Tool Cards

Active cards are links with:

- icon tile
- status badge
- title and description
- primary `Open tool` button-like affordance
- hover translate and shadow
- keyboard focus ring

Only active cards should use solid borders and the dark primary action.

### Upcoming And Locked Cards

Future tools and extension mockups use dashed or muted borders plus lock icons.
This communicates planned functionality without implying that the item is
clickable or installable.

### WordPress Plugin Mockups

WordPress plugin cards are ordinary informational cards. They currently have no
links, no install buttons, and no package metadata. When made operational, add a
separate field for install URL or package state rather than overloading
`description`.

### Chrome Extension Mockups

Chrome extension cards are preview-only. They use dashed borders and lock icons.
When made operational, add install/update/signing states explicitly:

- `Draft`
- `Packed`
- `Uploaded`
- `In review`
- `Published`

### Registration Form

The form is deliberately static:

- button type is `button`
- no `action`
- no server action
- no API call
- no local persistence

When registration becomes real, add validation and a backend path in the same
change. Do not silently turn the current demo button into a submit button without
adding visible success/error states.

## Responsive Behavior

The nav hides below `md` to preserve mobile width. The content collapses to one
column on small screens. Card grids progressively move from one column to two
or three columns using Tailwind breakpoints.

Manual browser checks covered:

- 1440x900 desktop viewport
- 390x844 mobile viewport
- zero horizontal overflow
- no console warnings or errors
- internal anchor navigation
- active tool link navigation
- demo form input behavior

## Maintenance Notes

Keep future edits small and data-driven:

1. Add new modules to the arrays before changing layout.
2. Keep operational and mockup states visually distinct.
3. Keep all user-facing home copy in English unless localization is introduced.
4. Run `npm run lint`, `npm run typecheck -- --incremental false`, and
   `npm run build` after meaningful changes.
5. For UI changes, verify in browser on desktop and mobile, not only via build.
