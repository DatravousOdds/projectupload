# Project Photos

An open web app for organizing photos into projects. Anyone who opens it can create projects, upload photos, view them in a grid and a full-size viewer, and delete photos or whole projects. There's no login.

**Live:** https://datravousodds.github.io/projectupload/

> Everything in the app is public. Anyone with the URL can view, add, or delete projects and photos. Don't upload anything private.

What the app does, its data model and its acceptance criteria are in [SPEC.md](SPEC.md). How we work on it (architecture rules, testing, conventions) is in [CLAUDE.md](CLAUDE.md).

## Setup

You need Node 24 (the version CI uses) and a Supabase project.

1. Install dependencies:
   ```
   npm ci
   ```
2. Create `.env` in the project root with your Supabase URL and **anon** key. Both are in the Supabase dashboard under Project Settings → API:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
   Never put the service-role key here. Anything starting with `VITE_` is bundled into the public JavaScript. The app refuses to start, and names the variable, if either one is missing.
3. Apply the database migrations:
   ```
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   The migrations set up the triggers, Row Level Security, column grants, the `photos` Storage bucket and its policies. The `projects` and `photos` tables themselves aren't in a migration yet; their definitions are in SPEC.md → Data model.
4. If the schema changes, regenerate the TypeScript types:
   ```
   npx supabase gen types typescript --project-id <id> > src/types/database.ts
   ```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173/projectupload/ |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | `tsc -b` (plain `tsc --noEmit` checks nothing in this setup) |
| `npm run lint` | ESLint |
| `npm test` | Vitest in watch mode; `npx vitest run` for a single pass |

## Deploying

Every push to `master` runs `.github/workflows/deploy.yml`: install, typecheck, lint, tests, build, then publish to GitHub Pages. A failing check stops the deploy.

One-time repo setup:
- Settings → Pages → Source → **GitHub Actions**.
- Settings → Secrets and variables → Actions → **Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use variables, not secrets, because both end up in the public JavaScript anyway. Redeploy after changing them.

## Key decisions

- **No login, protected by database rules.** Row Level Security, column grants and Storage policies decide what the anon key can do. For example, it can't edit projects, can't change a photo's paths, and can't delete files of a photo that still exists. If privacy is needed later, add Supabase Auth and tighten the policies; the rest of the app stays the same.
- **Three layers.** `src/api/` talks to Supabase, `src/hooks/` wraps it in TanStack Query, and components and pages only call hooks. Each layer can be tested on its own, and the UI never imports Supabase.
- **TanStack Query for server data, React state for UI.** Caching, loading and error states come from Query, so there's no global state library.
- **Images are processed in the browser before upload.** Originals are compressed to WebP (up to 2560px) and a 400px WebP thumbnail is made; grids only load thumbnails. This saves storage and bandwidth and strips location data from photos. Uploads run 3 at a time to limit memory use.
- **Delete the row first, then the files.** Storage only allows deleting files that no row points to. If a file delete fails, the user still sees the photo gone, and the leftover files are logged for cleanup.
- **Cache-busting URLs.** Replacing a photo overwrites the same file path, and `getPhotoUrl` adds `?v={updated_at}` so the new image shows at once.
- **GitHub Pages under a sub-path.** Vite's `base` and the router's `basename` are `/projectupload/`. Pages has no rewrite rules, so the workflow copies `index.html` to `404.html`, which makes refreshing on `/projects/:id` work.
