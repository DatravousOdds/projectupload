# CLAUDE.md

Project Photos: an open (no login) web app for creating projects and uploading, replacing, and deleting photos in them.

**SPEC.md is the source of truth.** Read the relevant section before starting any task. If this file and SPEC.md disagree, stop and ask.

## Scope rule
- The acceptance criteria in SPEC.md are the scope. Build only what they require.
- No login, no admin menu, no extra features, settings, or screens.
- Don't add things "while you're in there." If something seems missing, ask; don't build it.

## How we work
1. **Plan first.** Before writing code, list the files you'll create or change and what each change does. Wait for approval on anything beyond a small fix.
2. **Test first (TDD)** for logic in `src/lib/` and `src/api/`: write a failing test, make it pass, then clean up.
3. **One slice at a time**, following the build order in SPEC.md. Keep diffs small enough to review in one pass.
   - **Make it work:** plain, functional UI with basic Tailwind layout (spacing, readable text, usable on mobile). No custom visual design, animations, or color schemes yet.
   - **Test it:** confirm the slice's acceptance criteria in the browser and with tests.
   - **Then improve:** design polish and refinements come in later iterations, only when I ask.
4. **Verify before saying done:** run `npm run typecheck`, `npm run lint`, and `npx vitest run`. All must pass. Say which checks you ran.
5. **Don't commit or push** unless asked.
6. If you're stuck after two attempts at the same problem, stop and explain what you tried.

## Explaining your work
These explanations go in your messages to me, not in code comments (code comments stay short, per the rules below).

**In the plan, before coding:** for each notable choice, name the option you picked, the main alternative, and why. One or two lines each:
> **Upload queue:** a simple batch loop of 3 at a time, instead of a queue library. Meets the memory rule with no new dependency.

**After coding:** list each file you changed with a one-line explanation of what it does and why:
> - `src/lib/images.ts`: `createThumbnail()` resizes to 400px WebP so grids never load originals.
> - `src/hooks/useUploadPhotos.ts`: tracks per-file status so failed files can be retried alone.

Keep it concise: no restating the code, no long paragraphs. Skip explanations for trivial changes.

## Commands
```
npm run dev         # Vite dev server at http://localhost:5173
npm run build       # production build to dist/
npm run typecheck   # tsc -b (checks app + node configs; plain tsc --noEmit checks nothing here)
npm run lint        # ESLint
npm test            # Vitest in watch mode; `npx vitest run` for a single pass
npx supabase gen types typescript --project-id <id> > src/types/database.ts
```

## Stack
React + TypeScript (strict) + Vite, Tailwind CSS v4, React Router, TanStack Query, Supabase (Postgres + Storage), hosted as a Render Static Site. **No new dependencies without asking.**

## Principles
- **Functionality first, design later.** Get each feature working and tested before styling it. Iterate on design only after the feature passes its acceptance criteria.
- **KISS:** choose the simplest solution that meets the acceptance criteria.
- **YAGNI:** don't build features or abstractions that aren't needed yet. No "for later" options, generic wrappers, or config for one use case.
- **DRY:** every piece of logic lives in exactly one place. If you're about to copy and paste, extract a reusable function instead. (Don't force abstractions on code that only looks similar; that breaks KISS.)
- **Separation of concerns:** each module, function, and component does one distinct job. See Architecture below.

## Architecture
Three layers. Keep them separate:

| Layer | Folder | Rules |
|---|---|---|
| Data access | `src/api/` | Plain async functions that call Supabase. No React. Throw on error. |
| Custom hooks | `src/hooks/` | Wrap `api/` functions in `useQuery` / `useMutation`. Invalidate the right query keys on success. |
| UI | `src/components/`, `src/pages/` | Call hooks only. **Never import `supabase` in a component or page.** |

- Pure helpers (validation, thumbnails) live in `src/lib/` and must have unit tests.
- Query keys: `['projects']`, `['project', id]`, `['photos', projectId]`.

## Naming and structure
- Descriptive names that say what a thing is or does: `uploadPhoto`, `thumbnailBlob`, `isUploading`, not `doIt`, `data2`, `flag`.
- **camelCase** for variables and functions; **PascalCase** for components and types; **UPPER_SNAKE_CASE** for constants (`MAX_FILE_SIZE_BYTES`).
- Booleans read as questions: `isLoading`, `hasPhotos`, `canReplace`.
- Keep code scannable: blank lines between logical steps, early returns instead of deep nesting, functions short enough to read without scrolling.
- Function components and hooks only; named exports; one component per file, named after the component.

## Comments and docs
- **Comments are short and concise.** One line, explaining *why*, not just *what*. Skip comments the code already makes obvious.
- No multi-paragraph block comments; don't restate names or types.
- README explains how to set up and run the project, and why key decisions were made (link to SPEC.md rather than repeating it).

## Code conventions
- No `any`. Use generated types from `src/types/database.ts`; never hand-write table types.
- Styling with Tailwind classes only. No inline `style` props, no separate CSS files beyond `index.css`.
- Every data-driven screen handles loading, error, and empty states.
- Interactive elements are real `<button>`s or `<a>`s, keyboard-usable, with visible focus styles. Icon-only buttons need `aria-label`.
- Mobile first: must work at 360px wide.

## Input validation
Validate every input before using it:
- **Form fields:** trim, check required and length limits (match the database checks in SPEC.md), show inline errors.
- **Files:** check MIME type and size before any processing or upload (upload and replace).
- **Route params:** check `:id` is a valid UUID before querying; invalid → not-found page.
- Validation functions live in `src/lib/validation.ts`, are reused everywhere (DRY), and are unit tested.
- The database constraints and bucket limits are the backstop, not the only check.

## Error handling
- Use `try/catch` where an error can actually be handled: file reading, thumbnail generation, and each step of the upload and replace flows.
- **Never swallow errors.** Either handle them (show a message, allow retry) or rethrow.
- `api/` functions throw; hooks and components surface errors to the user through TanStack Query's error state. Don't wrap every call in its own `try/catch`.
- User-facing messages are plain language; technical details go to `console.error`.

## Testing
- Unit tests (Vitest) for everything in `src/lib/` and `src/api/`, written first.
- Component tests (React Testing Library) for forms, dialogs, and anything with branching UI states.
- Test file sits next to the file it tests: `images.ts` → `images.test.ts`.
- Mock Supabase in unit tests; never hit the real project from tests.
- Cover the failure paths too: invalid input, oversize files, Supabase errors.

## Performance and memory (especially photos)
- **Profile before optimizing.** Measure with browser DevTools first; don't add complexity for a problem you haven't seen.
- Avoid unnecessary loops: don't loop over the same data twice when once works, and never query Supabase inside a loop when one query can fetch everything.
- **Process uploads in small batches** (max 3 files at a time), not all at once, so large selections don't exhaust memory.
- **Compress thumbnails** (WebP, ~400px). Grids always show thumbnails, never originals. Originals are compressed before upload (WebP, 2560px long edge) per SPEC.md → Photo flows → Upload.
- **Release memory:** call `bitmap.close()` after using an `ImageBitmap`, and `URL.revokeObjectURL()` for every object URL once it's no longer shown.
- Use `loading="lazy"` on grid images.

## Supabase rules
- Client is created once in `src/lib/supabase.ts` from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Only the anon key in this project.** Never use, request, or write the service-role key anywhere.
- **Never read or print `.env`.** If a key is missing, tell me which one.
- All schema, RLS, grant, trigger, and storage policy changes go in a new file in `supabase/migrations/`. Never edit an existing migration.
- **Never weaken security to make something work.** Don't disable RLS, add broad policies, or grant extra columns. If an operation is blocked, stop and explain why.
- Delete is permanent: delete the photo row first, then its two Storage files. Never delete projects.
- Replace overwrites the same Storage paths with `upsert: true`; never create new paths on replace.

## Image URLs
- **Always use `getPhotoUrl(photo, 'original' | 'thumb')`** from `src/api/photos.ts`. Never build a Storage URL anywhere else.
- It appends `?v={updated_at}` so replaced photos show immediately.

## Security
- Never use `dangerouslySetInnerHTML`.
- Never commit `.env`. Keep `.env.example` in sync when variables change.

## Before finishing a task
- [ ] Only files in the approved plan were changed (or I explained why).
- [ ] Tests written first for new logic; typecheck, lint, and tests pass.
- [ ] All inputs validated; errors handled or surfaced, never swallowed.
- [ ] No duplicated logic, no unused code, no features beyond the acceptance criteria.
- [ ] Loading, error, and empty states handled.
- [ ] Each changed file explained in one line; notable choices explained against the alternative.
- [ ] Tell me how to check the change in the browser, and which acceptance criteria it covers.