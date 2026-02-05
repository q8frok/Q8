# /style — Glassmorphism Design System

Reference for Q8's Tailwind v4 glassmorphism design tokens and patterns.

## Auto-Invocation
This skill activates automatically when working on styling, CSS, or Tailwind classes.

## Design Tokens

### Glass Panels
```
backdrop-blur-[24px] bg-white/[0.04] border border-white/[0.06] rounded-2xl
```

### Elevated Glass (hover/active states)
```
backdrop-blur-[32px] bg-white/[0.08] border border-white/[0.10]
```

### Neon Accents
- Primary (electric purple): `text-[var(--color-neon-primary)]` / `bg-[var(--color-neon-primary)]`
- Accent (cyber green): `text-[var(--color-neon-accent)]` / `bg-[var(--color-neon-accent)]`
- Neon glow: `shadow-[0_0_20px_var(--color-neon-primary)]`

### Typography
- Headings: `text-white font-semibold`
- Body: `text-white/70`
- Muted: `text-white/40`

### Spacing (Bento Grid)
- Grid gap: `gap-4` or `gap-6`
- Card padding: `p-4` or `p-6`
- Widget min-height: `min-h-[200px]`

## Rules
- Never use opaque backgrounds on glass panels — always use transparency.
- Border opacity should be lower than background opacity.
- Use `backdrop-blur` on all floating/overlay elements.
- Dark theme only — all colors assume dark background.
- Prefer CSS custom properties from the design system over hardcoded values.
