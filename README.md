# txbyt

Upload a spreadsheet, get suggested charts, approve the good ones, publish them.

Next.js 15 (App Router) · Supabase (project `txbyt`, ref `pzdrvpszytvjsfchhoti`) · Vercel · Claude API

## How it works

1. **Upload** (`/dashboard`): Excel/CSV is parsed in the browser (SheetJS). Column types are auto-detected and can be corrected before saving. Up to 5,000 rows are stored.
2. **Suggest** (`/api/suggest`): Claude sees only a summary of the columns plus a dozen sample rows, and returns chart *specs* (type, columns, aggregation, headline). Specs are validated against the real columns before saving as drafts.
3. **Review** (`/dashboard/datasets/[id]`): approve, reject, edit, or download PNG/SVG.
4. **Publish**: approved charts get a slug and a frozen snapshot of their computed values (`published_data`), so public pages never read raw datasets.
5. **Public site**: `/` (feed), `/c/[slug]` (chart page with embed code), `/embed/[slug]` (iframe-able).

All numbers on a chart are computed in `lib/charts/compute.ts`, never by the AI.

## Setup

1. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase dashboard, Project Settings, API keys (publishable/anon key)
   - `ANTHROPIC_API_KEY` — console.anthropic.com
   - `NEXT_PUBLIC_SITE_URL` — production URL once deployed
2. `npm install && npm run dev`
3. In Supabase, Authentication, URL Configuration: set Site URL to the production URL and add
   `http://localhost:3000/auth/callback` and `https://<prod-domain>/auth/callback` to redirect URLs.
4. Create your user (sign up via magic link on `/login`, or add a user in Supabase Auth), then make it an admin:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

   New accounts start as `viewer` and can't upload until promoted to `editor` or `admin`.

## Database

- `profiles` — role per user (`admin`, `editor`, `viewer`)
- `datasets` — parsed rows + column profile
- `charts` — spec, headline, status (`draft` → `approved` → `published`, or `rejected`), slug, `published_data`
- RLS: staff (admin/editor) can do everything; the public can read published charts only.

## Next steps

- Maps (choropleth) and stacked-bar templates
- Brand kits per client
- Scheduled data refresh for published charts
