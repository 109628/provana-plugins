---
name: design-system
description: >
  Provana design token architecture (primitive→semantic→component), CSS variables,
  Tailwind theme configuration, spacing/typography scales, component state specs.
  Use when setting up a new project's design system, extending tokens, or auditing
  for hardcoded values. Reference this before any shadcn/ui theme customization.
---

# Provana Design System

Three-layer token architecture. Single source of truth for all UI styling decisions.

## Token Architecture

```
Primitive tokens (raw values)
         ↓
Semantic tokens (purpose aliases)
         ↓
Component tokens (component-specific)
```

**Rule: components only reference semantic or component tokens — never primitives directly.**

---

## Primitive Tokens

Raw values. Only referenced by semantic layer, never by components.

```css
/* Colors — Provana Brand */
--color-blue-50: #eff6ff;
--color-blue-100: #dbeafe;
--color-blue-500: #3b82f6;
--color-blue-600: #2563eb;   /* primary brand */
--color-blue-700: #1d4ed8;
--color-blue-900: #1e3a8a;

--color-gray-50:  #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-200: #e5e7eb;
--color-gray-300: #d1d5db;
--color-gray-400: #9ca3af;
--color-gray-500: #6b7280;
--color-gray-600: #4b5563;
--color-gray-700: #374151;
--color-gray-800: #1f2937;
--color-gray-900: #111827;
--color-gray-950: #030712;

/* Status */
--color-green-600: #16a34a;
--color-amber-500: #f59e0b;
--color-red-600:   #dc2626;
--color-blue-600:  #2563eb;

/* Typography */
--font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'Courier New', monospace;

/* Spacing scale (4pt base) */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Border radius */
--radius-sm:  4px;
--radius-md:  6px;
--radius-lg:  8px;
--radius-xl:  12px;
--radius-full: 9999px;
```

---

## Semantic Tokens

Map primitives to purpose. Used by component tokens and utility classes.

```css
:root {
  /* Backgrounds */
  --background:          var(--color-gray-50);
  --background-surface:  #ffffff;
  --background-elevated: #ffffff;
  --background-muted:    var(--color-gray-100);
  --background-subtle:   var(--color-gray-50);

  /* Foregrounds */
  --foreground:          var(--color-gray-900);
  --foreground-muted:    var(--color-gray-500);
  --foreground-subtle:   var(--color-gray-400);

  /* Brand */
  --color-primary:       var(--color-blue-600);
  --color-primary-hover: var(--color-blue-700);
  --color-primary-fg:    #ffffff;

  /* Status */
  --color-success:       var(--color-green-600);
  --color-warning:       var(--color-amber-500);
  --color-destructive:   var(--color-red-600);
  --color-info:          var(--color-blue-600);

  /* Borders */
  --border:              var(--color-gray-200);
  --border-focus:        var(--color-blue-500);
  --border-input:        var(--color-gray-300);

  /* Shadows */
  --shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.1);
}

.dark {
  --background:          var(--color-gray-950);
  --background-surface:  var(--color-gray-900);
  --background-elevated: var(--color-gray-800);
  --background-muted:    var(--color-gray-800);
  --background-subtle:   var(--color-gray-900);

  --foreground:          var(--color-gray-50);
  --foreground-muted:    var(--color-gray-400);
  --foreground-subtle:   var(--color-gray-500);

  --color-primary:       var(--color-blue-500);
  --color-primary-hover: var(--color-blue-400);

  --border:              var(--color-gray-800);
  --border-input:        var(--color-gray-700);

  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: none;
}
```

---

## Tailwind Theme Configuration

`tailwind.config.ts` — extend, never override base:

```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace'],
      },
      fontSize: {
        'xs':   ['12px', { lineHeight: '16px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg':   ['18px', { lineHeight: '28px' }],
        'xl':   ['24px', { lineHeight: '32px' }],
        '2xl':  ['32px', { lineHeight: '40px' }],
        '3xl':  ['48px', { lineHeight: '56px' }],
      },
      spacing: {
        // 4pt base — already matches Tailwind defaults
        // Reference: space-1=4px, space-2=8px, space-4=16px, space-8=32px
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

---

## Component Tokens

Component-specific tokens that reference semantic layer:

```css
/* Button */
--btn-primary-bg:     var(--color-primary);
--btn-primary-hover:  var(--color-primary-hover);
--btn-primary-fg:     var(--color-primary-fg);
--btn-height-sm:      32px;
--btn-height-md:      40px;
--btn-height-lg:      48px;

/* Input */
--input-height:       40px;
--input-border:       var(--border-input);
--input-focus-ring:   var(--border-focus);
--input-bg:           var(--background-surface);

/* Table */
--table-header-bg:    var(--background-muted);
--table-row-even:     color-mix(in srgb, var(--background-muted) 30%, transparent);
--table-border:       var(--border);

/* Card */
--card-bg:            var(--background-surface);
--card-border:        var(--border);
--card-shadow:        var(--shadow-sm);
--card-padding:       var(--space-6);

/* Badge — status */
--badge-success-bg:   color-mix(in srgb, var(--color-success) 15%, transparent);
--badge-success-fg:   var(--color-success);
--badge-warning-bg:   color-mix(in srgb, var(--color-warning) 15%, transparent);
--badge-warning-fg:   color-mix(in srgb, var(--color-warning) 50%, #000);
--badge-error-bg:     color-mix(in srgb, var(--color-destructive) 15%, transparent);
--badge-error-fg:     var(--color-destructive);
```

---

## Component State Specifications

Every interactive component needs these states defined:

| State | Visual Treatment |
|---|---|
| Default | base styles |
| Hover | `background-muted` or `primary` at 10% opacity overlay |
| Focus | 2px ring `border-focus`, 2px offset |
| Active/Pressed | `primary` at 90% brightness |
| Disabled | `opacity-50`, `cursor-not-allowed`, no hover effects |
| Loading | spinner replaces content, `pointer-events-none` |
| Error | `border-destructive`, error icon, error message below |
| Success | `border-success`, check icon |

### Button State Example
```tsx
<button
  className={cn(
    'h-10 px-4 rounded-md font-medium text-sm transition-colors',
    'bg-primary text-primary-foreground',
    'hover:bg-primary/90',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'active:scale-[0.98]',
    'disabled:opacity-50 disabled:pointer-events-none',
  )}
/>
```

---

## Anti-Patterns (Never Do)

```tsx
// WRONG — hardcoded color
<div style={{ color: '#2563eb' }}>

// WRONG — arbitrary Tailwind value from raw hex
<div className="text-[#2563eb]">

// CORRECT — semantic token
<div className="text-primary">
```

```tsx
// WRONG — mixing dark mode variants without semantic tokens
<div className="bg-white dark:bg-gray-900">

// CORRECT — semantic token handles both
<div className="bg-background">
```

---

## Audit: Find Hardcoded Values

Run before any PR that touches styles:

```bash
# Find hardcoded hex colors in components
grep -rE '#[0-9a-fA-F]{3,6}' --include="*.tsx" --include="*.css" src/

# Find hardcoded rgb/rgba
grep -rE 'rgb\(|rgba\(' --include="*.tsx" --include="*.css" src/

# Should return 0 results in component files
# Exceptions: globals.css primitive token definitions only
```
