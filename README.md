<img width="936" height="680" alt="image" src="https://github.com/user-attachments/assets/7534aa28-bd87-4fe4-9424-bea2d10307e8" />

# SportSync

Automatically sync sports match schedules to any calendar app via a personal iCal feed.

Subscribe to competitions, teams, or nations — upcoming matches appear in your calendar automatically, including reschedules and status updates.

## Features

- **Google sign-in** — one click, no setup for users
- **Universal calendar support** — iCal feed works with Google Calendar, Apple Calendar, Outlook, and any app that supports webcal subscriptions
- **Team & competition subscriptions** — follow Real Madrid, the Champions League, or any team/league
- **Automatic sync** — Vercel cron runs every 5 hours; manual "Sync Now" button available
- **Smart deduplication** — hash-based change detection avoids unnecessary updates
- **Provider-agnostic** — sports data layer is abstracted; swap providers without changing the sync engine

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Auth | Auth.js v5 (Google OAuth) |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle ORM |
| Calendar | `ical-generator` (iCal feed) |
| Sports data | SportRadar Soccer API v4 |
| Deployment | Vercel (free tier) |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Google Cloud](https://console.cloud.google.com) project with OAuth credentials
- A [SportRadar](https://developer.sportradar.com) API key (trial works)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/sportsync.git
cd sportsync
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection Pooler (Transaction mode) |
| `AUTH_SECRET` | Run `openssl rand -hex 32` |
| `AUTH_GOOGLE_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client |
| `AUTH_GOOGLE_SECRET` | Same as above |
| `SPORTRADAR_API_KEY` | SportRadar developer portal |
| `CRON_SECRET` | Run `openssl rand -hex 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` for dev |

### 3. Google OAuth setup

In Google Cloud Console:
1. Create an OAuth 2.0 Client ID (Web application)
2. Add `http://localhost:3000` to **Authorized JavaScript origins**
3. Add `http://localhost:3000/api/auth/callback/google` to **Authorized redirect URIs**

### 4. Run migrations

```bash
npm run db:generate   # generate migration files from schema
npm run db:migrate    # apply migrations to the database
```

### 5. Seed the entity database

This populates the search index with competitions and teams (~10k entries). Takes ~7 minutes due to SportRadar rate limits.

```bash
npm run bootstrap
```

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Landing page
│   ├── dashboard/page.tsx              # Main dashboard
│   ├── settings/page.tsx               # User settings
│   └── api/
│       ├── auth/[...nextauth]/         # Auth.js handler
│       ├── calendar/[token]/route.ts   # iCal feed endpoint
│       ├── subscriptions/route.ts      # GET + POST subscriptions
│       ├── subscriptions/[id]/route.ts # DELETE subscription
│       ├── search/route.ts             # Entity search
│       ├── sync/route.ts               # Manual sync trigger
│       ├── cron/sync/route.ts          # Vercel cron endpoint
│       └── user/route.ts               # User profile CRUD
├── components/
│   ├── add-subscription-modal.tsx
│   ├── calendar-instructions.tsx
│   ├── settings-form.tsx
│   ├── subscription-list.tsx
│   ├── sync-button.tsx
│   └── ui/                             # shadcn/ui components
└── lib/
    ├── auth.ts                         # Auth.js config
    ├── db/
    │   ├── index.ts                    # DB connection (lazy init)
    │   └── schema.ts                   # Drizzle schema
    ├── ical/
    │   └── generator.ts                # iCal feed builder
    ├── providers/
    │   ├── types.ts                    # SportsDataProvider interface
    │   ├── index.ts                    # Provider registry
    │   └── sportradar/                 # SportRadar implementation
    │       ├── api-types.ts            # Zod-validated response schemas
    │       ├── client.ts               # Typed HTTP client
    │       └── index.ts                # Provider implementation
    ├── sync/
    │   ├── engine.ts                   # Core sync logic (heart of the app)
    │   ├── hash.ts                     # Event hash for change detection
    │   └── date-utils.ts
    └── bootstrap/
        ├── seed-entities.ts            # One-time entity seeder
        └── fix-display-names.ts        # Backfill gender/age suffixes
```

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Auth + calendar token per user |
| `subscribable_entities` | Search index of competitions & teams |
| `subscriptions` | User → entity subscriptions |
| `sport_events` | Global match cache (not per-user) |
| `sync_log` | Audit log of every sync run |

**Key design decision:** `sport_events` is a global table — not per-user. User–event relationships are computed at iCal generation time by matching `home_team_provider_id`, `away_team_provider_id`, and `competition_provider_id` against the user's subscribed entities. This keeps the sync engine O(entities) instead of O(users × entities).

## Deployment (Vercel)

1. Push to GitHub
2. Import into Vercel
3. Add all environment variables from `.env.local.example` (update `NEXTAUTH_URL` to your Vercel URL)
4. Deploy
5. Add your Vercel URL to Google Cloud Console's authorized redirect URIs
6. Run `npm run bootstrap` once against the production database

The cron job (`0 */5 * * *`) is configured in `vercel.json` and runs automatically after deploy.

## npm Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run bootstrap` | Seed entity search index |
| `npm run bootstrap:fix-names` | Backfill gender/age suffixes on team names |

## Adding a New Sports Provider

1. Implement `SportsDataProvider` from `src/lib/providers/types.ts`
2. Register it in `src/lib/providers/index.ts`
3. Set `SPORTS_PROVIDER=your-provider-name` in env
4. Run bootstrap for the new provider
