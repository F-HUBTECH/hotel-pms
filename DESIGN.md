---
name: Hotel PMS
description: ระบบบริหารจัดการโรงแรมสำหรับตลาดประเทศไทย — professional, efficient, trustworthy
colors:
  deep-indigo:
    value: oklch(0.511 0.262 277)
    role: accent
  deep-indigo-light:
    value: oklch(0.96 0.02 275)
    role: accent-surface
  deep-indigo-muted:
    value: oklch(0.67 0.2 277)
    role: accent-muted
  ink:
    value: oklch(0.145 0 0)
    role: text-primary
  ink-soft:
    value: oklch(0.205 0 0)
    role: text-secondary
  paper:
    value: oklch(1 0 0)
    role: surface-primary
  paper-tinted:
    value: oklch(0.985 0 0)
    role: surface-secondary
  stone:
    value: oklch(0.97 0 0)
    role: surface-tertiary
  fog:
    value: oklch(0.922 0 0)
    role: border
  ash:
    value: oklch(0.556 0 0)
    role: text-muted
  midnight:
    value: oklch(0.145 0 0)
    role: surface-inverse
  midnight-deep:
    value: oklch(0.1 0 0)
    role: sidebar
  red-clay:
    value: oklch(0.577 0.245 27.325)
    role: destructive
  emerald-moss:
    value: oklch(0.7 0.16 145)
    role: success
  amber-grain:
    value: oklch(0.75 0.15 85)
    role: warning
typography:
  body:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.05em"
    textTransform: uppercase
  title:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.25
  headline:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.25
  display:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.15
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "calc(0.625rem - 4px)"
  md: "calc(0.625rem - 2px)"
  lg: "0.625rem"
  xl: "calc(0.625rem + 4px)"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.deep-indigo}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: oklch(0.44 0.25 277)
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.stone}"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge:
    backgroundColor: "{colors.deep-indigo-light}"
    textColor: "{colors.deep-indigo}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Hotel PMS

## 1. Overview

**Creative North Star: "The Front Desk Counter"**

เคาน์เตอร์หน้าโรงแรมที่แสงนวล สะอาด มีระดับ — พื้นผิวหินอ่อนสีอ่อน ตัดด้วยไม้สีเข้มและแสงไฟ warm white ทุกอย่างอยู่ในตำแหน่งที่คุ้นเคย: ปากกา, ทะเบียน, เครื่องรูดบัตร ก่อนที่แขกจะเดินเข้ามา พนักงานมองปราดเดียวก็รู้ว่าอะไรอยู่ตรงไหน

ระบบ visual ของ Hotel PMS ออกแบบมาเพื่อสนับสนุนการทำงานภายใต้แรงกดดัน: ข้อมูลหนาแน่นแต่เป็นระเบียบ, สีสงบไม่รบกวนสมาธิ, layout ที่คาดเดาได้ ไม่มีการตกแต่งที่เกินจำเป็น ทุก element มีหน้าที่ของมัน — ถ้า element ไหนไม่ได้ช่วยให้ทำงานเร็วขึ้น, มันไม่มีที่อยู่ในระบบนี้

**Key Characteristics:**
- Neutral-dominant palette with a single deep indigo accent — the accent signals action and state, never decoration
- Tonal layering over shadows — surfaces are distinguished by background color, not elevation
- Single typeface family (Geist) across all levels — hierarchy through weight and size, not font changes
- Dark sidebar anchoring the layout — the darkest surface provides stable spatial orientation

This system explicitly rejects: consumer-app aesthetics, admin-template generics, decorative color, gradient text, glass effects, oversized hero metrics, and any element that exists solely to "look designed."

## 2. Colors

The palette is deliberate in its restraint. One accent (Deep Indigo) carries all action/state meaning. Everything else is neutral — not for lack of imagination, but because the data IS the color.

### Accent

- **Deep Indigo** (`oklch(0.511 0.262 277)`): The sole accent color. Used on primary buttons, active navigation items, selected states, and the sidebar branding gradient. Its rarity is the point — when you see indigo, you know something is actionable, active, or selected.
- **Deep Indigo Light** (`oklch(0.96 0.02 275)`): Tinted background for badges, selected rows, and subtle callouts. Used sparingly; never as a full-section background.
- **Deep Indigo Muted** (`oklch(0.67 0.2 277)`): Active icon color in the dark sidebar, focus rings. The brighter, lighter variant for dark-surface contexts.

### Neutral

- **Ink** (`oklch(0.145 0 0)`): Primary text on light surfaces. Near-black but not pure black — the 0.145 lightness keeps it readable without harshness.
- **Ink Soft** (`oklch(0.205 0 0)`): Secondary text, button labels, form labels. 0.205 lightness, still passes 4.5:1 on white.
- **Ash** (`oklch(0.556 0 0)`): Muted text for captions, placeholders, timestamps. Used only where the information is supplementary, never for body copy. Contrast verified: 5.2:1 against white.
- **Paper** (`oklch(1 0 0)`): Pure white — card surfaces, form backgrounds, main content area. The canvas.
- **Paper Tinted** (`oklch(0.985 0 0)`): Near-white — used for the page background (body), secondary surfaces.
- **Stone** (`oklch(0.97 0 0)`): The tertiary surface — hover states on ghost buttons, selected table rows without accent, muted section backgrounds.
- **Fog** (`oklch(0.922 0 0)`): Borders, dividers, input strokes. Visible enough to define edges, light enough to not compete with content.
- **Midnight** (`oklch(0.145 0 0)`): The inverse surface — dark mode background, dark card surfaces.
- **Midnight Deep** (`oklch(0.1 0 0)`): Sidebar background — slightly deeper than Midnight for spatial anchoring. The darkest surface in the system.

### Semantic

- **Red Clay** (`oklch(0.577 0.245 27.325)`): Destructive actions, error states, void indicators. Warm red-orange that reads clearly against both light and dark backgrounds.
- **Emerald Moss** (`oklch(0.7 0.16 145)`): Success states, completed indicators, positive trends.
- **Amber Grain** (`oklch(0.75 0.15 85)`): Warning states, pending indicators, "needs attention" badges.

### Named Rules

**The One Accent Rule.** Deep Indigo appears on ≤10% of any screen's surface area. Its scarcity is what makes it meaningful. If you're using it as a background for more than badges and selected states, you're using it wrong. The accent signals; the neutrals carry.

**The No-Tint Default Rule.** Tinted backgrounds (Deep Indigo Light, Stone) are applied deliberately to signal state — hover, selected, highlighted. The default surface is Paper or Paper Tinted, never tinted "because the brand feels warm." Warmth and hospitality come from the content (names, dates, currency) and the efficiency of the interaction, not from body background tinting.

## 3. Typography

**Font:** Geist (sans-serif) + Geist Mono (monospace)
**Character:** A single-family system. Geist is a geometric sans with clean apertures and even stroke contrast — it reads as neutral, modern, and highly legible at small sizes. No serif pairing; the data density of a PMS dashboard benefits from one clear voice. Geist Mono handles tabular data, codes, and financial figures where alignment matters.

### Hierarchy

- **Display** (700, `1.5rem` / 24px, 1.15): Page titles on dashboard sections ("Dashboard", "Reservations"). One per page.
- **Headline** (600, `1.125rem` / 18px, 1.25): Section headers within pages, card titles, dialog titles.
- **Title** (600, `0.875rem` / 14px, 1.25): Card sub-headings, table column headers, form section labels. The workhorse of the hierarchy.
- **Body** (400, `0.875rem` / 14px, 1.5): All running text, form values, table cell content, descriptions. Max line length 75ch on prose; table cells and labels are single-line.
- **Label** (500, `0.75rem` / 12px, 1.0, `letter-spacing: 0.05em`, uppercase): Sidebar section headers, input labels, badge text. Reserved for short phrases (≤4 words).
- **Mono** (400, `0.8125rem` / 13px, 1.5): Folio numbers, transaction IDs, GL account codes, VAT rates, currency amounts in tables.

### Named Rules

**The Single-Family Rule.** One typeface, many weights. Weight contrast (400 → 500 → 600 → 700) drives the entire hierarchy. Do not introduce a second sans-serif for "variety." Monospace is the only exception and only for data.

**The No-All-Caps Body Rule.** Uppercase is reserved for labels and badges (≤4 words). Never set sentences, descriptions, or table content in all caps. Thai script has no case; English text follows sentence case.

## 4. Elevation

This system uses **tonal layering**, not shadows, to convey depth and hierarchy. Three background levels create spatial separation without the cognitive weight of drop shadows:

1. **Page background** (Paper Tinted `oklch(0.985 0 0)`) — the canvas
2. **Card / surface** (Paper `oklch(1 0 0)`) — raised above the page via contrast, bordered with Fog
3. **Sidebar** (Midnight Deep `oklch(0.1 0 0)`) — the darkest surface, spatially anchoring the layout

Shadows appear at rest ONLY on the sidebar (to separate it from the content area — `border-r border-slate-800`). Interactive elements may gain a subtle shadow on hover (`shadow-md` transition, 150-200ms) as a response to state, never as decoration.

The top header uses `backdrop-blur-sm` against `bg-white/80` — the only blur in the system. It's functional (header is sticky), not decorative.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow that appears without user interaction signals an error in the design. Shadows respond to state (hover, focus, drag); they do not decorate static elements.

**The Three-Surface Rule.** Any given screen uses at most three distinct surface colors. More than three and the tonal layering collapses into visual noise. If you need a fourth, restructure the layout.

## 5. Components

### Buttons

**Character:** Tactile and confident. Buttons are the primary action mechanism — they must read as clickable at a glance.

- **Shape:** Rounded-md (`calc(0.625rem - 2px)`, approximately 6px). Gently curved, not pill-shaped, not sharp.
- **Primary:** Deep Indigo background (`oklch(0.511 0.262 277)`), Paper text (`oklch(1 0 0)`), padding `8px 16px`, weight 500. Used for the single most important action on any screen ("Save", "Create Reservation", "Post Payment"). One primary button per form/section.
- **Hover:** Darken to `oklch(0.44 0.25 277)`. Transition: `background-color 150ms ease`.
- **Focus:** Ring offset 2px, Deep Indigo ring at 50% opacity, 2px width.
- **Ghost:** Transparent background, Ink Soft text. Hover: Stone background. Used for secondary actions, table row actions, toolbar buttons. Icon + text in sidebar.
- **Destructive:** Red Clay background, Paper text. Used only for irreversible actions (void, delete, cancel reservation).
- **Disabled:** `opacity: 0.5`, `pointer-events: none`, no hover effect.

### Cards

**Character:** Clean containers that recede. Cards are vessels, not statements.

- **Shape:** Rounded-lg (`0.625rem`). Subtle enough to not draw attention to the container itself.
- **Background:** Paper (`oklch(1 0 0)`).
- **Border:** 1px Fog (`oklch(0.922 0 0)`) — the border is the primary edge definition; no shadow at rest.
- **Hover (interactive cards):** Border shifts to Deep Indigo Light, shadow `0 4px 12px rgba(0,0,0,0.08)`, transition 200ms.
- **Internal padding:** `24px` (xl spacing). Never nest cards inside cards.

### Inputs / Fields

**Character:** Understated and ready. Inputs feel like paper forms — clear boundaries, no decoration.

- **Style:** 1px Fog border, Paper background, rounded-md. Height minimum 40px for touch targets.
- **Focus:** Border shifts to Deep Indigo, ring 2px Deep Indigo at 25% opacity. Transition 150ms.
- **Placeholder:** Ash (`oklch(0.556 0 0)`). Contrast verified: 5.2:1 against Paper.
- **Error:** Border Red Clay, Red Clay background tint (oklch with chroma ~0.02 at same hue). Error message in Red Clay, 12px, below the input.
- **Disabled:** Stone background, Fog border, Ash text. `cursor: not-allowed`.

### Navigation (Sidebar)

**Character:** The spatial anchor. Dark, stable, always present.

- **Background:** Midnight Deep (`oklch(0.1 0 0)`), width 260px expanded / 68px collapsed. Transition: `width 300ms ease`.
- **Brand:** Logo icon in a Deep Indigo → Violet gradient square (9×9), Hotel icon in white.
- **Section headers:** 10px, weight 600, uppercase, letter-spacing 0.05em, Ash text (on dark: `oklch(0.55 0 0)`).
- **Nav items:** 14px, weight 400, Ash text by default. 12px vertical padding, 12px horizontal padding, rounded-md.
- **Active:** Deep Indigo Light background at 10% opacity, Deep Indigo Muted text. Left border or full background tint — never a side-stripe accent border >1px.
- **Hover:** Stone at 60% opacity (on dark), text shifts to Paper.

### Badges / Chips

- **Default:** Deep Indigo Light background, Deep Indigo text, 1px Deep Indigo Light border. 12px font, weight 500. Full-rounded (9999px). Padding `2px 10px`.
- **Success:** Emerald Moss at 15% opacity background, Emerald Moss text.
- **Warning:** Amber Grain at 15% opacity background, Amber Grain text.
- **Destructive:** Red Clay at 10% opacity background, Red Clay text.
- **Role badge (header):** Distinct treatment — Deep Indigo Light background, Deep Indigo text, weight 500, no border. Used only in the top header for user role display.

### Data Table

**Character:** Dense, scannable, neutral. The table is the primary data-viewing surface.

- **Header:** Stone background, Title typography (14px/600), Ink Soft text, bottom border 1px Fog.
- **Row:** Paper background, Body typography (14px/400). Alternating row colors are NOT used — uniform rows with hover state for the active row.
- **Hover:** Stone background on the entire row. Transition 100ms.
- **Selected:** Deep Indigo Light background. Used when the table supports row selection (e.g. folio item selection).
- **Pagination:** Below the table, right-aligned. Ghost buttons for page navigation, Ash text for "Page X of Y."
- **Empty state:** Centered in the table area. Ash text "No data" or context-specific message. A single relevant icon (e.g., ClipboardList for reservations).

## 6. Do's and Don'ts

### Do:

- **Do** use the three-surface tonal layering (Paper Tinted body → Paper cards → Midnight Deep sidebar) for all layouts. This is the spatial system.
- **Do** place the single primary action at the top-right or bottom-right of every form/section. Consistency of position reduces cognitive load under pressure.
- **Do** use 12px/14px font sizes for data-dense areas. The PMS is an operations tool; density is a feature, not a bug.
- **Do** confirm every destructive action (void, delete, cancel) with a dialog that names the specific item being affected. "Void payment #PAY-0042?" not "Are you sure?"
- **Do** use Thai locale for dates and currency (฿) throughout. This is a Thai-market product.
- **Do** respect the One Accent Rule — Deep Indigo must signal action/state, never appear as decoration.

### Don't:

- **Don't** use side-stripe borders (`border-left` or `border-right` > 1px) as colored accents on cards, list items, or alerts. Use full borders, background tints, or leading icons.
- **Don't** use gradient text (`background-clip: text`). Emphasis through weight or size only.
- **Don't** use glassmorphism or background blur outside the sticky header. Decorative blur has no place in an operations tool.
- **Don't** nest cards inside cards. If you need hierarchy within a surface, use a Stone background section or a divider.
- **Don't** use identical icon + heading + text card grids. Vary the layout; cards that all look the same convey no information hierarchy.
- **Don't** add uppercase tracked eyebrows above every section. Sidebar section headers are the only uppercase tracking use; page content does not repeat the pattern.
- **Don't** introduce a second accent color. Deep Indigo is the only accent. Success/warning/destructive are semantic, not decorative.
- **Don't** use all-caps for body copy, descriptions, or table content. Labels and badges only.
