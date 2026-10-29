# Muhammad Kairu Electronics — Brand Kit & Design Studio

A single-tenant brand kit and design studio for **Muhammad Kairu Electronics** (Electronics Retail & Solar Energy, Jos, Plateau State, Nigeria). The whole application is a client-side SPA served at `/` (hash-based views) backed by Next.js API routes under `/api/*`. Every design — logo, letterhead, business card, flyer, social post — is stored as an **editable DesignDocument JSON** (never flattened), rendered by one SVG-string engine so that what you see in the editor is exactly what gets exported.

## Features

- **Logo Studio** — start from templates or a blank canvas, edit with drag/resize/rotate, layers panel, undo/redo, and **editable logo variants** (primary, symbol-only, horizontal, stacked, monochrome) plus an **export wizard** (format, scale, transparency, paper size, crop marks).
- **Brand Settings & Brand Kit** — persistent business profile (name, address, phones, socials, palette, typography) that auto-fills every design; one-click **brand-kit ZIP** download (SVG + PNG@2x per variant, `brand-info.json`, README).
- **Letterhead Designer** — A4 letterhead with brand header/footer blocks and exact-size PDF export.
- **Business Card Designer** — front **and** back pages, standard card sizes, crop marks for print.
- **Complimentary Card Designer** — branded voucher/thank-you cards.
- **Multi-Image Flyer Generator** — a layout engine that arranges multiple product photos, prices (₦ formatted), availability badges and brand blocks into poster/ flyer pages; step-by-step wizard.
- **Social Post Templates** — square/story presets for promos.
- **Product Library** — reusable catalogue (name, category, price, availability, notes, images) feeding the flyer wizard and designs.
- **My Designs** — all projects with thumbnails, **revision history (versions)**, archive, duplicate and **restore**.
- **Export Centre** — history of every export (format, size, scale, paper size) with re-download context.
- **AI Assistant** (server-side via z-ai-web-dev-sdk):
  - LLM design assistant that proposes document edits **with a preview you explicitly accept or reject**;
  - AI **image generation** (several aspect ratios);
  - AI **edit of a reference image** (upload an image, describe the change).
- **Exports** — SVG (true vector), PNG/JPG (canvas raster at 1–4x, PNG transparency), PDF (vector via svg2pdf.js with automatic raster fallback, optional crop marks), browser print at exact physical size, and brand-kit ZIP.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, `output: "standalone"`) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix primitives), lucide-react, framer-motion |
| State / data fetching | zustand, @tanstack/react-query |
| Database | PostgreSQL via Prisma 6 (Prisma Postgres on Vercel) |
| Auth | Custom JWT sessions (jose, HS256) + bcryptjs — httpOnly cookie **and** `Authorization: Bearer` fallback (works in embedded frames / cookie-blocking browsers), 30-day sliding expiry, per-IP login rate limiting |
| Design engine | Custom SVG-string renderer (`src/lib/design/svg.ts`) — single renderer for editor, thumbnails and all exports |
| Exports | jsPDF + svg2pdf.js (vector PDF), canvas raster (PNG/JPG), JSZip (brand kit), qrcode (QR elements), browser print |
| AI | z-ai-web-dev-sdk (LLM chat, image generation, image edit) — server-side API routes only |
| Image processing | sharp |
| Runtime | Bun (dev and production) |

## Quick Start

Requires [Bun](https://bun.sh) and Node-compatible tooling.

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
#    then edit .env (see "Environment variables" below)

# 3. Apply committed PostgreSQL migrations
bun run db:migrate:deploy

# 4. Run the dev server
bun run dev          # http://localhost:3000 (logs are tee'd to dev.log)
```

**First run:** open http://localhost:3000 and register the **owner account** (email + password of at least 8 characters). Registration is only possible while **no user exists** — afterwards the register endpoint is locked and you sign in instead. Registering seeds the persistent brand settings with the business defaults: *Muhammad Kairu Electronics*, No. 41 Ahmadu Bello Way, Shop 31A, Rochas Plaza, Jos, Plateau State, Nigeria; phones 07038365737 / 09037621052; tagline “Powering Homes. Entertaining Families.”; NGN (₦) price formatting; palette navy `#1F2A44` / amber `#F5A623` / red `#C43D2F` / dark `#101820` / light `#F7F5F0`; Arial typography.

## Environment Variables

| Variable | Required | Default / fallback | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string from Prisma Postgres or your PostgreSQL provider |
| `AUTH_SECRET` | **Required in production** | None in production; development can use `db/.auth-secret` | Stable secret used to sign session JWTs. Set a random value of 32+ characters, e.g. `openssl rand -hex 32`. |
| `NODE_ENV` | Auto | `development` / `production` | Set by the scripts; in production the session cookie gets the `secure` flag |
| `PORT` | No | `3000` | Port used by the production standalone server (`bun run start`) |

Production uses PostgreSQL, not a file-backed SQLite database. On Vercel, connect the Prisma Postgres integration and ensure `DATABASE_URL` is available in Production and Preview. Set `AUTH_SECRET` as a sensitive environment variable in every environment, then redeploy. Never commit either secret.

See `.env.example` for a commented template.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server on port 3000, output tee'd to `dev.log` |
| `bun run build` | `next build` → standalone output; copies `.next/static` and `public/` into `.next/standalone/` |
| `bun run start` | `NODE_ENV=production bun .next/standalone/server.js` (honours `PORT`), output tee'd to `server.log` |
| `bun run lint` | ESLint over the repository |
| `bun run db:push` | Development-only convenience command; **do not use for production schema changes** |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run db:migrate:deploy` | Apply committed PostgreSQL migrations to the configured database |
| `bun run vercel-build` | Apply migrations, then build the app (Vercel build command) |

## API Overview

All endpoints require a session except `/api/health` and the auth entry points.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Liveness + database check (never 500s; reports `degraded`) |
| `/api/auth/register` | POST | Create the owner account — only allowed while no user exists; seeds brand settings |
| `/api/auth/login` | POST | Sign in (rate limited: 10 attempts / 5 min / IP, in-memory) |
| `/api/auth/logout` | POST | Clear the session cookie |
| `/api/auth/session` | GET | Current session user |
| `/api/brand` | GET, PUT | Read / update brand settings |
| `/api/projects` | GET, POST | List / create design projects |
| `/api/projects/[id]` | GET, PUT, DELETE | Load / save (with version snapshot) / delete a project |
| `/api/projects/[id]/duplicate` | POST | Duplicate a project |
| `/api/projects/[id]/restore` | POST | Restore a saved version |
| `/api/projects/[id]/versions` | GET, POST | Revision history snapshots |
| `/api/assets`, `/api/assets/[id]` | GET, POST, DELETE | Uploaded images stored as data-urls |
| `/api/products`, `/api/products/[id]` | GET, POST, PUT, DELETE | Product catalogue |
| `/api/exports` | GET, POST | Export history records |
| `/api/ai/assistant` | POST | LLM design assistant (proposes edits; applied only on explicit accept) |
| `/api/ai/image` | POST | AI image generation (raster PNG, multiple aspect ratios) |
| `/api/ai/edit-image` | POST | AI edit of a reference image (returns raster proposal) |

## Data Model (Prisma / PostgreSQL)

- **User** — owner account (bcrypt password hash, role). Single-business deployment; the schema can accommodate more users later.
- **BrandSettings** — one-per-user persistent business profile + palette/typography + official logo reference.
- **DesignProject** — `doc` holds the editable **DesignDocument JSON** (source of truth), plus preview thumbnail, template flag, archive flag.
- **ProjectVersion** — snapshot of `doc` for revision history and restore.
- **Asset** — uploaded images stored as data-urls in PostgreSQL (with kind, size, dimensions).
- **Product** — catalogue items (price kept as a string to allow `₦` formatting).
- **ExportRecord** — metadata history of every export (files themselves download straight to the browser; nothing is stored server-side).

## Production Deployment

### Build and run

```bash
bun run build       # produces a self-contained .next/standalone/
bun run start       # NODE_ENV=production, honours PORT (default 3000), logs to server.log
```

For Vercel, the `vercel-build` script runs `prisma migrate deploy` before the production build. The committed migrations create the PostgreSQL schema. For a manual deployment, run `bun run db:migrate:deploy` with the correct `DATABASE_URL` before starting the app.

Set `AUTH_SECRET` explicitly in every production environment (32+ random characters). Production authentication intentionally fails closed when this secret is missing; it will not generate a per-instance file secret.

### Reverse proxy (TLS)

The repo's own `Caddyfile` is the sandbox proxy (listens on `:81` → `localhost:3000`, forwards `Host`/`X-Forwarded-*`). For a real deployment with automatic HTTPS, use a Caddyfile like:

```caddyfile
brand.example.com {
    encode gzip
    reverse_proxy localhost:3000 {
        header_up X-Real-IP {remote_host}
    }
}
```

Or nginx + certbot:

```nginx
server {
    listen 80;
    server_name brand.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then issue a certificate with `certbot --nginx -d brand.example.com` (the app sets the `secure` cookie flag when `NODE_ENV=production`, so HTTPS is expected).

### systemd unit (Ubuntu VPS example)

```ini
# /etc/systemd/system/mk-brand-kit.service
[Unit]
Description=Muhammad Kairu Electronics Brand Kit & Design Studio
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mk-brand-kit
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
Environment=AUTH_SECRET=<paste output of: openssl rand -hex 32>
ExecStart=/usr/local/bin/bun /opt/mk-brand-kit/.next/standalone/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mk-brand-kit
```

Notes:
- Keep `AUTH_SECRET` stable across restarts and all application instances. PostgreSQL stores the persistent app data; no local database file is required.
- The app process does not need write access to a local database directory when using PostgreSQL.
- If you deploy only the `standalone/` folder to the server, run `bun run db:migrate:deploy` from the project with the production `DATABASE_URL` before starting the app.

### Persistence & backup

PostgreSQL stores the persistent application data. Back up the database using the provider's supported backup/export tools, and keep `AUTH_SECRET` in a secure password manager or secrets manager. Do not copy a local SQLite file for PostgreSQL deployments. Restoring the database and restoring the same `AUTH_SECRET` preserves both saved data and existing session validity.

## Testing & QA

### Automated checks

```bash
bun run test          # CSV import/export parsing regression tests
bun run lint          # ESLint
bunx tsc --noEmit     # type check (run separately because next.config.ts ignores build errors)
bun run build         # production build
```

GitHub Actions runs the test suite, TypeScript check, ESLint, and production build on every pull request targeting `main`. The unit tests cover quoted commas, escaped quotes, embedded line breaks, UTF-8 BOMs, Windows line endings, empty rows, and malformed quoting. The checklist below contains additional manual end-to-end checks; these should be performed in the browser before a production launch.

### Manual test checklist

**Auth**
- [ ] First run shows owner registration; after registering, a reload keeps you signed in (30-day sliding session). Even with cookies cleared, the Bearer-token fallback keeps you signed in.
- [ ] With a user present, registration is refused with a clear message; login works; wrong password shows an error.
- [ ] Logout clears the session; API calls then return 401 and the UI shows the sign-in screen.
- [ ] 10 failed logins within 5 minutes trigger the rate limit.

**Logo editor**
- [ ] Create a logo from a template; drag, resize and rotate elements; reorder in the layers panel.
- [ ] Undo/redo across structural edits.
- [ ] Switch between editable variants (primary / symbol / horizontal / stacked / mono) — each remains editable.
- [ ] Export wizard: SVG opens as clean vectors; PNG at 1x/2x/4x with transparent-background option; vector PDF has selectable text; crop marks option for print sizes.

**Flyer wizard end-to-end**
- [ ] Add products (from library and/or multi-image upload), pick a layout, generate pages, tweak the result, export multi-page PDF and PNG; verify brand details and ₦ prices appear.

**Letterhead & business card (front + back) / complimentary card**
- [ ] Template creation pre-fills brand data; export PDF at exact paper size with crop marks; both card sides export as separate pages.

**Persistence**
- [ ] Save a project, reload the page — design and hash-view restore intact.
- [ ] My Designs: duplicate and archive/unarchive work.

**Version restore**
- [ ] Save a version, make destructive edits, save again, restore the older version and confirm the document reverts exactly.

**Brand kit & export centre**
- [ ] Download the brand-kit ZIP (SVG + PNG@2x per variant + `brand-info.json`).
- [ ] Every export appears in the Export Centre with correct format/size metadata; browser print opens at the design's physical size.

**Mobile responsive**
- [ ] At ~375 px width: shell navigation, dashboard, product library and dialogs remain usable; the editor supports touch drag; export dialogs fit the viewport.

## AI Features

The `z-ai-web-dev-sdk` is **preconfigured in this sandbox** — AI works out of the box with no API key in `.env`.

- **LLM assistant** — describes/proposes edits to the open design. Every proposal is shown as a **preview that you explicitly accept or reject**; nothing is applied silently.
- **Image generation** — raster PNG proposals in several aspect ratios (1024×1024, 768×1344, 864×1152, 1344×768, 1152×864, 1440×720, 720×1440), inserted as image elements/assets.
- **AI image edit** — pick an uploaded reference image, describe the change, receive an edited **raster proposal**.

Important behaviours:
- If the AI service is unavailable, requests fail with a clear message and the app stays **fully usable** — all manual design and export tools are unaffected.
- AI image results are **flattened raster proposals**; they are never presented as (or substituted for) the editable vector design. The DesignDocument remains the editable source of truth, and you decide what enters it.

## Troubleshooting

- **Logs** — dev output: `dev.log` (`bun run dev` tees to it). Production output: `server.log`. Start there.
- **Port 3000 already in use** — stop the other process (`lsof -i :3000` / `kill <pid>`) or change the `-p 3000` in the `dev` script / set `PORT` for production.
- **Schema drift / “table does not exist”** — verify `DATABASE_URL` points to the intended PostgreSQL database, then run `bun run db:migrate:deploy` after checking the committed migration history.
- **Owner cannot sign in on a newly connected database** — the PostgreSQL database starts separately from the Z.ai SQLite database. If no user was migrated, use the first-run registration flow to create the owner account. Do not reset or delete a database to troubleshoot login.
- **Forgot password** — there is no password-reset flow. Use your PostgreSQL provider's SQL editor or a trusted local database client to update the owner's `passwordHash` with a bcrypt hash. Do not delete the user row as a login troubleshooting shortcut; related data can be cascade-deleted.
- **Everyone logged out unexpectedly** — `AUTH_SECRET` changed. Sessions are signed per secret; users can sign in again.
- **Export dialog warns about PDF fallback** — the vector PDF path failed for this document and a raster page was embedded instead (details in the browser console). Try image mode at a higher DPI, or simplify heavy elements (large embedded images, exotic effects).
- **AI actions fail** — network/SDK issue on the server side; see `dev.log`/`server.log`. The app remains fully usable without AI.
- **Thumbnails missing after a database migration/restore** — previews and uploaded assets are stored in the database as data-urls; verify the full database contents were migrated.

## Known Limitations

Honest list of what this build does **not** do:

- **No multi-user / multi-business tenancy yet.** One owner account per deployment. The schema (per-user relations everywhere) is ready for tenancy later, but the API/UI assume a single business.
- **No canvas grouping.** Multi-select *move* is supported, but there are no groups/frames; complex compositions are managed via the layers panel.
- **Web-font mapping in vector PDFs.** Georgia/Verdana/Trebuchet map to metric-compatible PDF base fonts (Times/Helvetica) in vector PDF mode, so glyph shapes can differ slightly from the on-screen preview. Use image-mode PDF for pixel-exact output.
- **No AI vectorisation of raster logos.** AI edits return flattened raster images; tracing a bitmap logo into editable vectors is not available.
- **PostgreSQL connection errors.** Confirm the Prisma datasource provider is `postgresql`, `DATABASE_URL` is the PostgreSQL URL from Vercel's Prisma Postgres integration, and the latest deployment includes the migration files.
- **No password-reset flow** (see Troubleshooting for the manual procedure) and export history stores metadata only — exported files download directly to the browser and are not archived server-side.
