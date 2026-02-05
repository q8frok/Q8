# /review — Code Review Checklist

Review current changes against Q8's quality standards.

## Steps

1. Get the diff of current changes:
   ```bash
   git diff
   git diff --staged
   ```
2. Review against this checklist:

### Type Safety
- [ ] No `any` types introduced
- [ ] Zod schemas match TypeScript interfaces
- [ ] RxDB schemas match Supabase tables

### Architecture
- [ ] UI reads from RxDB, not directly from API
- [ ] Optimistic updates used where appropriate
- [ ] No server-side imports in client components
- [ ] Components in correct directory (ui/, dashboard/, voice/, shared/)

### Security
- [ ] No hardcoded secrets or API keys
- [ ] Input validation at API boundaries
- [ ] RLS policies cover new tables
- [ ] No XSS vectors (dangerouslySetInnerHTML, unescaped user input)

### Performance
- [ ] No unnecessary re-renders (memoization where needed)
- [ ] Images optimized (next/image)
- [ ] Dynamic imports for heavy components
- [ ] No blocking operations in render path

### Style
- [ ] Glass design system followed (backdrop-blur, transparency)
- [ ] Responsive design maintained
- [ ] Consistent spacing and typography

3. Report findings with severity levels: **Critical**, **Warning**, **Suggestion**.

## Rules
- Be specific — cite file paths and line numbers.
- Prioritize security and type safety issues.
- If no issues found, confirm the changes look good.
