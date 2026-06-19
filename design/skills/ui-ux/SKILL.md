---
name: ui-ux
description: >
  Comprehensive UI/UX rules for Provana engineering — accessibility, touch targets,
  typography, color, animation, forms, navigation, data tables, dashboards. Use when
  designing or reviewing any UI: admin panels, dashboards, data-heavy screens, forms,
  modals, reports. Skip for pure backend, API design, or non-visual work.
---

# Provana UI/UX Design Intelligence

## When to Apply

**Use for:**
- New page or screen design (Dashboard, Admin, Reports, Settings, Forms)
- UI component creation or refactoring
- Color, typography, spacing, or layout decisions
- UX/accessibility reviews
- Data tables, charts, and reporting interfaces
- Navigation and information architecture decisions

**Skip for:** Pure backend, API/DB design, DevOps, non-visual scripts.

> Decision rule: "If the task changes how a feature **looks, feels, moves, or is interacted with**"

---

## Priority Rule Categories

| Priority | Category | Impact |
|----------|----------|--------|
| 1 | Accessibility | CRITICAL |
| 2 | Data & Tables | CRITICAL — Provana primary use case |
| 3 | Forms & Validation | HIGH |
| 4 | Typography & Color | HIGH |
| 5 | Layout & Responsive | HIGH |
| 6 | Navigation Patterns | HIGH |
| 7 | Performance | HIGH |
| 8 | Animation | MEDIUM |
| 9 | Trust & Compliance UX | HIGH — regulatory industry |
| 10 | Dark Mode | MEDIUM |

---

## 1. Accessibility (CRITICAL)

- Contrast minimum **4.5:1** normal text, **3:1** large text (≥18px bold or ≥24px)
- Visible focus rings: **2–4px** solid, offset 2px, on all interactive elements
- Descriptive alt text; `aria-label` for icon-only buttons
- Tab order matches visual order; full keyboard navigation
- Respect `prefers-reduced-motion` — disable/reduce animations
- Never convey information by color alone — always add icon or text
- Screen reader announcements for async state changes (loading, error, success)
- WCAG 2.1 AA minimum; WCAG 2.2 for new builds

---

## 2. Data Tables & Dashboards (CRITICAL for Provana)

Provana's primary interfaces are data-heavy — agent performance, call logs, compliance flags.

### Table Rules
- Sticky header on scroll for tables >10 rows
- Alternating row colors: `bg-muted/30` on even rows — improves scan speed
- Numeric columns: **right-aligned**, tabular figures (`font-variant-numeric: tabular-nums`)
- Text columns: left-aligned
- Status columns: **center-aligned** with color + icon (never color alone)
- Sortable columns: show sort indicator always, not just on hover
- Min column width prevents text truncation on critical data
- Empty state: meaningful message + action button, never blank
- Loading state: skeleton rows matching actual row structure

### Pagination & Filtering
- Show total count: "Showing 1–25 of 1,247 records"
- Page size selector: 10 / 25 / 50 / 100
- Preserve filter state on page navigation (URL params)
- Filter chips visible above table showing active filters
- Reset filters: single "Clear all" button when ≥1 filter active

### Dashboard Cards
- KPI cards: metric large (32–48px), label small (12–14px), trend indicator
- Trend: green up-arrow = good, red down-arrow = bad — but also show value (`+12%`)
- Cards load independently with skeleton; never block the full dashboard
- Clickable cards: full card is the hit target, not just text

### Charts
- Match type to data: trend→line, comparison→bar/column, proportion→donut (≤5 segments), distribution→histogram
- Always show legend; tooltips on hover with precise values
- Provide text alternative for screen readers (`aria-label` on canvas)
- Color + pattern for colorblind accessibility
- Empty chart state: show axes + "No data for selected period" message
- Recharts (preferred in Next.js) or Chart.js — not D3 unless custom visualization needed

---

## 3. Forms & Validation (HIGH)

- Visible label per input — no placeholder-only labels
- Required fields: asterisk `*` with legend "* required" at top of form
- Error messages: below the field, specific cause + fix ("Phone must be 10 digits")
- Validate on **blur**, not on keystroke — except password strength meter
- Success state: green checkmark on field after valid blur
- Disable submit during async; show spinner on button
- Multi-step forms: progress indicator (step X of Y), allow back navigation
- Input width matches expected content: zip code = short, address = full width
- Use semantic input types: `email`, `tel`, `number`, `date`, `search`
- Password: show/hide toggle, strength meter for creation
- Phone: auto-format as user types (US: `(xxx) xxx-xxxx`)
- Date picker: keyboard-accessible, not just click
- Confirm destructive actions inline (not modal) for single-step actions

---

## 4. Typography & Color (HIGH)

### Type Scale
```
12px — captions, table headers, badges
14px — body secondary, form labels, metadata
16px — body primary (minimum on mobile)
18px — subheadings
24px — section headings
32px — page titles
48px — hero / KPI metrics
```

### Type Rules
- Body line-height: **1.5–1.75**
- Line length: **65–75 characters** for reading text; unrestricted for data tables
- Font weight: Regular (400) body, Medium (500) labels, Semibold (600) headings
- Never use more than 2 typefaces; 1 is better
- Provana stack: Inter (system UI fallback) or Geist (Next.js default)
- Tabular figures for all numbers in tables/metrics: `font-variant-numeric: tabular-nums`
- Monospace for IDs, codes, phone numbers: `font-mono`

### Color Rules
- Use semantic tokens, never raw hex in components (see `design-system` skill)
- Status colors: success `green-600`, warning `amber-500`, error `red-600`, info `blue-600`
- Status always has icon companion — color alone is not enough
- Muted text: `text-muted-foreground` — not gray hardcoded
- Destructive actions: red, but not so loud it creates anxiety on read-only screens
- Dark mode: desaturated variants, not inverted — `gray-900` bg, `gray-100` text

---

## 5. Layout & Responsive (HIGH)

- Viewport meta: `width=device-width, initial-scale=1` — never disable zoom
- Breakpoints: **375** (mobile), **768** (tablet), **1024** (desktop), **1440** (wide)
- Mobile-first CSS; add complexity at larger breakpoints
- No horizontal scroll on any viewport
- Spacing system: **4/8/16/24/32/48px** rhythm — use Tailwind spacing tokens
- Content max-width: `max-w-7xl` (1280px) for page content; full-width for tables
- Sidebar layouts: collapsible on mobile, always visible on desktop (≥1024px)
- Sticky headers: `top-0 z-50` — include backdrop blur `backdrop-blur-sm`
- Safe areas: respect `env(safe-area-inset-*)` for mobile web

### Admin/Dashboard Layouts
```
┌─────────────────────────────────────────┐
│ Top Nav (sticky, 64px)                  │
├──────────┬──────────────────────────────┤
│ Sidebar  │ Main Content                 │
│ (240px)  │ (flex-1, overflow-auto)      │
│          │                              │
│ nav items│ Page header (sticky)         │
│          │ ─────────────────────        │
│          │ Content scrolls here         │
└──────────┴──────────────────────────────┘
```

---

## 6. Navigation Patterns (HIGH)

- Current page: visually highlighted in nav — background + font weight change
- Back navigation: predictable; preserve scroll position and filter state
- Modals: not for primary navigation — only for quick actions
- Breadcrumbs: use for pages >2 levels deep
- Top nav: max 6–8 items; overflow to "More" dropdown
- Sidebar nav: group related items; section headers for visual separation
- Keyboard: `Escape` closes modals/dropdowns; arrow keys navigate menus
- After route transition: focus moves to main `<h1>` or content area

---

## 7. Performance (HIGH)

- Images: WebP/AVIF with `next/image` — never raw `<img>` in Next.js
- Declare explicit `width`/`height` to prevent CLS
- `font-display: swap` — already default in Next.js
- Virtualize lists with **50+ items** — use `@tanstack/virtual`
- Keep JS bundles lean: check `next build` output; route-split heavy components
- Skeleton screens for operations >**300ms**; spinner for >**1s**
- Prefetch critical routes with `<Link prefetch>` in Next.js
- Debounce search inputs: **300ms**

---

## 8. Animation (MEDIUM)

- Micro-interactions: **150–300ms**; page transitions ≤400ms
- Animate only `transform` and `opacity` — GPU-accelerated; never `width/height/top/left`
- Ease-out entering (`ease-out`), ease-in exiting (`ease-in`)
- Exit animations: ~60–70% of enter duration
- Animations interruptible — never block user input
- List item stagger: **30–50ms** per item; cap at 10 items (don't stagger 100 rows)
- Respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
- Framer Motion (for complex) or Tailwind `transition-*` utilities (for simple)

---

## 9. Trust & Compliance UX (HIGH — Regulatory Industry)

Provana operates in contact center / collections (FDCPA, TCPA). UI must convey:

### Trust Signals
- Status always clearly visible — agents and supervisors must know system state at a glance
- Data timestamps: always show when data was last updated ("Updated 2 min ago")
- Audit trail: actions that affect accounts should show confirmation + record who did what
- Error states: never blame the user — "Something went wrong, please try again" + support link

### Compliance-Sensitive UI
- Call disposition forms: mandatory fields must be visually obvious (red asterisk + tooltip)
- FDCPA-sensitive times: warn if scheduling outside permitted hours
- Do-Not-Call indicators: red badge, prominent, impossible to miss
- Consent status: always visible on contact records — never buried
- Print/export actions: confirmation dialog noting data sensitivity

### Supervisor vs Agent Roles
- Different views for different roles — agents see their own data; supervisors see team
- Role-based color accent: subtle difference in nav accent to remind users of their context
- Destructive role actions (override, unlock, delete): require explicit confirmation + reason

---

## 10. Dark Mode (MEDIUM)

- Default: respect `prefers-color-scheme`; allow manual toggle stored in `localStorage`
- Implement via `class` strategy in Tailwind (`darkMode: 'class'`)
- Test both modes before shipping any UI
- Dark backgrounds: `gray-950` (bg), `gray-900` (surface), `gray-800` (elevated)
- Never invert light mode colors — design dark mode independently
- Shadows: remove in dark mode; use borders (`border-gray-800`) instead
- Images: add `dark:opacity-90` to reduce brightness on photos

---

## Pre-Delivery Checklist

### Visual Quality
- [ ] No hardcoded hex colors — semantic tokens only
- [ ] Consistent icon family (Lucide preferred in shadcn/ui stack)
- [ ] No emojis as structural icons
- [ ] Both light and dark mode verified

### Data Interfaces
- [ ] Tables have sticky headers, sort indicators, empty state
- [ ] Numeric columns right-aligned with tabular figures
- [ ] Status columns use color + icon (not color alone)
- [ ] Pagination shows total count
- [ ] Loading states are skeleton (not spinner) for tables

### Accessibility
- [ ] All interactive elements keyboard accessible
- [ ] Focus rings visible
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast 4.5:1 body, 3:1 large text
- [ ] Screen reader tested (at minimum: tab through the form)

### Layout
- [ ] No horizontal scroll at 375px viewport
- [ ] Spacing follows 4/8px rhythm
- [ ] Sticky elements (header, sidebar) don't overlap content
- [ ] Tested at 375 / 768 / 1440 widths

### Forms
- [ ] All fields have visible labels
- [ ] Required fields marked
- [ ] Error messages specific and actionable
- [ ] Submit disabled during loading

### Compliance (Provana-specific)
- [ ] DNC indicators are prominent
- [ ] FDCPA-sensitive data has appropriate visual weight
- [ ] Destructive actions require confirmation
- [ ] Data timestamps visible
