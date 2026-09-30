# Project Photos — Spec (v1)

## Summary
A simple web app for organizing photos into projects. Anyone who opens the app can create projects, upload photos into them, replace or delete unwanted photos, browse all projects, and open a project to see its details and photos. Projects and photos are stored in Supabase, so they persist across refreshes and devices.

## Access model: open, no login
- There are no accounts and no login screen. Every visitor sees and works with the same shared set of projects.
- **All projects and photos are public.** Anyone with the URL (or the Supabase key from the page) can view them. Don't upload anything private.
- Visitors can **view, add, replace, and delete photos**, and **view and add projects**.
- **Replace overwrites the photo's file.** The previous image is gone and can't be recovered.
- **Delete hides the photo (soft delete)**, with an Undo in the app. Deleted photos can also be restored from the Supabase dashboard.
- Upgrade path: if privacy is needed later, add Supabase Auth (anonymous or magic link), add a `user_id` column, and tighten the policies. The rest of the app stays the same.

## Tech stack
| Layer | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| UI framework | React (function components + hooks) |
| Routing | React Router (browser history) |
| Server state | TanStack Query (fetching, caching, loading/error states) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Build / dev server | Vite (`react-ts` template) |
| Database | Supabase Postgres |
| File storage | Supabase Storage (public bucket `photos`) |
| Hosting | Render Static Site |
| Tests | Vitest + React Testing Library (units/components), Playwright (flows, later) |
| AI tooling | Claude Code, guided by `CLAUDE.md` and this spec |

No other UI or state libraries without discussion. TanStack Query holds server data; React state holds UI state. No global state library.

## Data model (Postgres)

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,     -- {project_id}/{photo_id}        (never changes)
  thumb_path text not null,       -- {project_id}/{photo_id}_thumb  (never changes)
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz          -- null = visible; set = soft-deleted
);

create index photos_project_id_idx on photos(project_id) where deleted_at is null;
```

Storage paths have no file extension, so a replacement always lands at the same path even if the file type changes (e.g. JPEG → PNG). The browser uses the stored content type to display it.

### Triggers
```sql
-- Keep projects.updated_at current when photos are added, replaced, or deleted
create function touch_project() returns trigger as $$
begin
  update projects set updated_at = now() where id = new.project_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger photos_touch_project
after insert or update on photos
for each row execute function touch_project();

-- Stamp photos.updated_at on every change
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger photos_set_updated_at
before update on photos
for each row execute function set_updated_at();
```

### Row Level Security and permissions
RLS stays **enabled** on both tables, with explicit policies for the `anon` role:

| Table | select | insert | update | delete |
|---|---|---|---|---|
| projects | allowed | allowed | blocked | blocked |
| photos | allowed | allowed | allowed (limited columns, see below) | blocked |

Column-level limits on photo updates, so a client can only change the file details or mark it deleted:

```sql
revoke update on photos from anon;
grant update (file_name, mime_type, size_bytes, width, height, deleted_at)
  on photos to anon;
```

`id`, `project_id`, `storage_path`, `thumb_path`, and `created_at` can't be changed by the client. Deleted photos are filtered out in the app's queries (`deleted_at is null`), not by the select policy, to avoid RLS conflicts when soft-deleting.

### Storage
- Bucket `photos` is **public**, so images display with plain public URLs.
- Bucket settings: file size limit 15 MB; allowed MIME types `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic`.
- Storage policies for `anon` on the `photos` bucket: select, insert, and update allowed (update is needed to overwrite on replace); delete blocked.
- Uploads set `contentType` to the file's MIME type.

### Cache busting (replaced photos show immediately)
On replace, the **file location in Storage stays the same** (that's what makes it an overwrite), but the **URL the app displays changes**, so the new image appears right away.

How it works:
- The database never stores URLs. The app builds each image URL from `storage_path` (or `thumb_path`) plus the photo's `updated_at`:
  ```
  {publicUrl}?v={updated_at as a timestamp}
  ```
- Replacing a photo bumps `updated_at` (via trigger), so the `?v=` value changes, e.g. `?v=1727558400` → `?v=1727558712`.
- Browsers and Supabase's CDN treat the changed URL as a new image and fetch it fresh. Supabase ignores `?v=` and serves the single file at that path.
- Build URLs in one helper (`getPhotoUrl(photo, 'original' | 'thumb')` in `api/photos.ts`) and use it everywhere, so no component builds URLs by hand.
- Uploads use a short `cacheControl` (e.g. `'60'` seconds) as a backup.

### TypeScript types
Generate with `supabase gen types typescript` into `src/types/database.ts`. Don't hand-write table types.

## Routes and screens

| Path | Component |
|---|---|
| `/` | `ProjectListPage` |
| `/projects/:id` | `ProjectDetailPage` |
| `*` | `NotFoundPage` |

### ProjectListPage
- Cards: name, photo count (excluding deleted), cover thumbnail (newest visible photo or placeholder), last updated date.
- Sorted by `updated_at` descending.
- "New project" button opens `ProjectFormModal`.
- Empty state prompting the first project; loading skeletons while fetching.
- Small footer note: "Projects and photos here are public."

### ProjectFormModal
- Name (required), description (optional).
- **Photos (optional):** an "Add photos" button (`accept="image/*"`, `multiple`) that can be used more than once; each pick appends to a small thumbnail grid inside the form.
  - Each file is validated when picked (same rules as upload); invalid files show an error and are not added.
  - Each thumbnail has **Remove** and **Replace**. Nothing is saved yet, so neither asks for confirmation; they only change the local list.
  - Previews use object URLs, revoked when a photo is removed or replaced and when the form closes.
- Inline validation; Save disabled while submitting.
- **Save:** create the project, then upload the picked photos into it (see Photo flows → Upload). Nothing reaches Supabase until Save, so closing the form without saving leaves nothing behind.
- While uploading, each photo shows its progress; the form can't be closed.
- If every photo uploads (or none were picked): close the form and stay on the project list, which refreshes to show the new project.
- If some photos fail: the project and the successful photos are kept. The form stays open with the fields locked, marks the failed photos with an error and a **Retry**, and offers **Close** to return to the list with what uploaded.

### ProjectDetailPage
- Header: name, description, created date, photo count.
- Upload button (`accept="image/*"`, `multiple`).
- Per-file upload progress; failed files show an error and a retry option.
- Thumbnail grid (`PhotoGrid`), newest first, visible photos only.
- Each thumbnail has an actions menu (visible on hover on desktop, always visible on touch): **Replace** and **Delete**.
- Empty state when no photos.
- Unknown id → "Project not found" with link back.

### PhotoViewer (overlay)
- Full-size image via public URL (with cache-busting version).
- File name, dimensions, size, upload date, last replaced date (if different), caption.
- **Replace** and **Delete** buttons.
- Prev/next buttons and arrow keys; Esc closes; focus is trapped while open and returned to the thumbnail on close.

### ConfirmDialog
Used before both destructive actions. Cancel has default focus; Esc or clicking outside cancels.
- Delete: "Delete this photo? It will be removed from the project." (red Delete button)
- Replace: "Replace this photo? The current image will be permanently overwritten." (Replace button)

## Photo flows

### Upload
1. Validate each file: image MIME type, ≤ 15 MB (matches bucket limit).

2. Compress before upload: decode with `createImageBitmap` (applies EXIF orientation), resize so the long edge is at most 2560px (never upscale), and re-encode to WebP at ~0.82 quality with canvas. If the result isn't smaller than the original, upload the original instead. Re-encoding also strips EXIF metadata (including GPS location).
   - **GIFs** are uploaded as-is (re-encoding would keep only the first frame); they still get a WebP thumbnail.
   - **Files the browser can't decode** (e.g. HEIC outside Safari) are uploaded as-is for both the original and thumbnail paths, with `width`/`height` null. Where an image can't be displayed, the grid and viewer show a "Preview not available in this browser" placeholder instead of a broken image.
   - Record the MIME type the browser actually produced; browsers that can't encode WebP return PNG.

3. Read the final dimensions and generate a ~400px WebP thumbnail from the same decoded bitmap.

4. Generate the photo id client-side (`crypto.randomUUID()`), then upload the compressed image and thumbnail to `{project_id}/{photo_id}` and `{project_id}/{photo_id}_thumb`.

5. Insert the `photos` row with that id (the trigger updates the project's `updated_at`).

6. Invalidate the photos and projects queries so the grid and list refresh.

If the thumbnail upload or the row insert fails after a file was uploaded, log the orphaned paths to the console; they can be cleaned up in the Supabase dashboard.

### Replace
1. User clicks Replace (grid menu or viewer) → file picker opens (single file, `accept="image/*"`).
2. Validate and generate a thumbnail (same rules as upload).
3. `ConfirmDialog` confirms the overwrite, showing the new file's name.
4. Upload original and thumbnail to the **same paths** with `upsert: true`, overwriting the old files.
5. Update the photo row's file columns (`file_name`, `mime_type`, `size_bytes`, `width`, `height`). The trigger bumps `updated_at`, which changes the cache-busting version.
6. The photo keeps its id, caption, grid position, and created date.
7. Invalidate queries so the new image shows immediately.

If step 5 fails after step 4 succeeded, the new image is stored but the details shown are stale. Show an error and let the user retry the row update.

### Delete
1. User clicks Delete → `ConfirmDialog`.
2. On confirm, set `deleted_at = now()`.
3. Remove the photo from the grid optimistically; roll back and show an error if the update fails.
4. In the viewer, move to the next photo, or close if it was the last one.
5. Show a toast: "Photo deleted" with an **Undo** button for 5 seconds, which sets `deleted_at` back to null.

To restore a deleted photo later, set `deleted_at` to null on its row in the Supabase dashboard.

Hooks: `useUploadPhotos()` (project id passed per call, since the form has none until Save), `useReplacePhoto()`, `useDeletePhoto()`, `useUndoDelete()`.

## Acceptance criteria
- [ ] A created project appears in the list and persists after refresh and on another device.
- [ ] Photos can be added while creating a project, one or several at a time and in more than one pick; each appears in the form's grid before saving.
- [ ] In the form, a picked photo can be removed or replaced before saving, without a confirmation.
- [ ] Closing the form without saving creates no project and uploads no files.
- [ ] Saving creates the project, uploads its picked photos, closes the form, and shows the new project in the list with its photo count.
- [ ] If some photos fail to upload on save, the form shows which ones, lets each be retried, and can still be closed.
- [ ] Uploaded photos appear only in their project and persist after refresh.
- [ ] Refreshing on `/projects/:id` on the deployed site reloads that project (no 404).
- [ ] Multiple files upload at once with visible progress.
- [ ] Non-images and oversize files are rejected with a clear message (upload and replace).
- [ ] Replacing a photo asks for confirmation, then shows the new image immediately in the same grid position with the same caption, including after refresh.
- [ ] After a replace, the Storage bucket still has exactly one original and one thumbnail for that photo (no extra files).
- [ ] Deleting a photo asks for confirmation, removes it from the grid and counts, and survives refresh.
- [ ] Undo within 5 seconds restores a deleted photo.
- [ ] With the anon key, Supabase rejects: deleting any row, updating projects, updating `project_id` or paths on photos, and deleting Storage files.
- [ ] Layout works from 360px phone width to desktop; photo actions are usable on touch devices.
- [ ] `tsc --noEmit` and ESLint pass; no console errors or React key warnings in normal use.

## Security rules
- Only the Supabase **anon/publishable** key goes in the front end. The service-role key never appears in client code or the repo.
- Never use `dangerouslySetInnerHTML` for user content. (React escapes text by default.)
- `.env` is gitignored; commit a `.env.example` instead.
- Watch Supabase storage usage on the dashboard; the free tier has limits and the bucket is open to uploads.

## Environment variables
Two files at the project root:

| File | Contains | Committed to git? |
|---|---|---|
| `.env` | Real values for local development | **No** (listed in `.gitignore`) |
| `.env.example` | Same variable names, empty values | Yes, so others know what's needed |

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- Both values come from Supabase dashboard → Project Settings → API.
- Read them in `src/lib/supabase.ts` via `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. Throw a clear error at startup if either is missing.
- Declare their types in `src/vite-env.d.ts` so TypeScript knows about them.
- **Vite rule:** any variable starting with `VITE_` is bundled into the public JavaScript. Only the anon key goes here. The service-role key must never have a `VITE_` prefix and should not be in this project's `.env` at all.
- On Render, set the same two variables in the static site's Environment settings. Vite reads them at build time, so redeploy after changing them.

## Hosting (Render Static Site)
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Auto-deploy from the `main` branch.
- **Rewrite rule:** source `/*` → destination `/index.html` (action: Rewrite). Required for React Router; without it, refreshing on `/projects/:id` returns a 404.

## Out of scope for v1
**The acceptance criteria are the scope.** Anything not required by an acceptance criterion is out of scope, including:
- Login, accounts, or user management of any kind
- An admin menu, admin screens, or admin-only features
- Any feature, screen, or setting not listed in the acceptance criteria

When building, don't add extras "while you're in there." If something seems missing, raise it as a question and add an acceptance criterion first.

## File structure
```
index.html
src/
  main.tsx                 # React root, QueryClientProvider, RouterProvider
  App.tsx                  # route definitions
  index.css                # @import "tailwindcss"; theme tokens
  vite-env.d.ts            # types for import.meta.env variables
  lib/
    supabase.ts            # client singleton, env check
    images.ts              # compression, dimensions, thumbnails
    format.ts              # dates, file sizes, photo counts for display
    validation.ts          # input validation: project form, files, route ids (pure functions)
  api/
    projects.ts            # query/mutation functions
    photos.ts              # upload, replace (upsert), soft delete, undo, list, versioned URLs
  hooks/
    useProjects.ts
    useProject.ts
    usePhotos.ts
    useUploadPhotos.ts
    useReplacePhoto.ts
    useDeletePhoto.ts
  components/
    AppHeader.tsx
    ProjectCard.tsx
    ProjectFormModal.tsx
    PhotoGrid.tsx
    PhotoPickerGrid.tsx      # previews and upload status inside ProjectFormModal
    PhotoActionsMenu.tsx
    PhotoViewer.tsx
    UploadButton.tsx
    ConfirmDialog.tsx
    Toast.tsx
    EmptyState.tsx
    ErrorState.tsx           # load-failed message with Try again
  pages/
    ProjectListPage.tsx
    ProjectDetailPage.tsx
    NotFoundPage.tsx
  types/
    database.ts            # generated Supabase types
supabase/
  migrations/              # SQL for tables, triggers, RLS, grants, storage bucket + policies
tests/
.env                       # real keys, gitignored, never committed
.env.example               # empty template, committed
.gitignore                 # includes .env
CLAUDE.md
SPEC.md
```

## Build order (slices)
1. `npm create vite@latest` (react-ts) + Tailwind + React Router; deploy "hello world" to Render with the rewrite rule to prove the pipeline.
2. Supabase project, migrations for tables, triggers, RLS, grants, and bucket; generate types.
3. TanStack Query setup; create and list projects.
4. Photo upload pipeline: `photos` and Storage migrations, file validation, compression and thumbnails (`lib/images.ts`), `api/photos.ts` upload, `useUploadPhotos` with progress.
5. Photos in `ProjectFormModal`: pick, preview grid, remove/replace locally, upload on save, per-photo retry.
6. `ProjectDetailPage` with `PhotoGrid` (newest first; uploads appear in the grid as they finish) and `PhotoViewer` as an overlay on the same page, plus its own upload button (reusing step 4).
7. Delete: `ConfirmDialog`, soft delete, optimistic update, undo toast.
8. Replace: file picker, confirm, upsert to same paths, row update, verify the new image shows without a hard refresh.
9. Edge cases: validation, not-found, error states, confirm the blocked operations in the acceptance criteria.
10. Polish: responsive pass, touch-friendly actions, keyboard navigation, loading skeletons.

## Open questions
1. Is 15 MB the right max file size for your photos?
2. Should delete also free up storage immediately (permanent delete, no undo), instead of hiding the photo?