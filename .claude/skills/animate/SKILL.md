# /animate — Framer Motion Patterns

Animation patterns for Q8's glass UI using Framer Motion.

## Auto-Invocation
This skill activates automatically when adding animations or transitions.

## Standard Patterns

### Page/Widget Enter
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
>
```

### Staggered List
```tsx
<motion.div variants={container} initial="hidden" animate="show">
  {items.map((item, i) => (
    <motion.div key={item.id} variants={listItem}>
      {/* content */}
    </motion.div>
  ))}
</motion.div>

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};
```

### Glass Panel Hover
```tsx
<motion.div
  whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
```

### Layout Animations
```tsx
<motion.div layout layoutId={`widget-${id}`}>
  {/* content that repositions smoothly */}
</motion.div>
```

### Exit Animations
```tsx
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      key="element"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    />
  )}
</AnimatePresence>
```

## Rules
- Use `ease: [0.25, 0.46, 0.45, 0.94]` (custom easeOut) for enter animations.
- Use spring physics for interactive elements (hover, drag).
- Keep durations under 0.5s for UI elements — snappy, not sluggish.
- Always wrap conditional renders in `AnimatePresence`.
- Use `layoutId` for shared element transitions between views.
- Import from `framer-motion` (not `motion`).
