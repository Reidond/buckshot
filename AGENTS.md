# AGENTS.md — buckshot

YouTube Shorts multi-account uploader. Manages 1,000-2,000+ Google accounts, distributes uploads across a pool of GCP projects for quota scaling, auto-filters dead accounts. Deployed on Cloudflare Workers via OpenNext.

Read `SPEC.md` for full product specification. Read skills for code conventions.

## Stack

Next.js 15+ (App Router, RSC, Server Actions) · Bun · Biome · TypeScript (strict) · Drizzle ORM · Cloudflare D1/R2/KV/Queues · NextAuth.js v5 · Tailwind v4 · shadcn/ui · Zod

## Commands

```bash
bun run dev                    # local dev server
bun run check                  # biome lint + format
bun run check --write          # auto-fix
bun run db:generate            # drizzle-kit generate migrations
bun run db:migrate:local       # apply to local D1
bun run build                  # next build
bun run deploy                 # opennextjs-cloudflare + wrangler deploy
bun test                       # run tests
bun run create-admin           # create first super_admin
bun run pool:add               # CLI: add GCP project to pool
```

## Project layout

```
src/
├── app/
│   ├── (auth)/                 # Login (unauthenticated layout)
│   ├── (dashboard)/            # All authed pages (pool, accounts, upload, jobs, etc.)
│   └── api/                    # REST route handlers
├── components/
│   ├── ui/                     # shadcn/ui primitives (don't edit)
│   └── [feature]/              # Feature components (pool/, accounts/, uploads/)
├── lib/                        # Business logic (NO React, NO UI)
│   ├── db/schema.ts            # Single source of truth for all tables
│   ├── pool/                   # GCP project assignment + health
│   ├── accounts/               # Health checks + auto-cleanup
│   ├── youtube/                # API client, resumable upload, quota tracking
│   ├── google/                 # OAuth flow, token refresh
│   ├── queue/consumer.ts       # Upload queue processor
│   ├── crypto.ts               # AES-256-GCM encrypt/decrypt
│   └── validators.ts           # Shared Zod schemas
├── actions/                    # Server Actions (thin wrappers around lib/)
├── hooks/                      # React hooks
└── types/                      # Shared TypeScript types
scripts/
├── create-admin.ts
├── pool-add.ts                 # CLI for adding GCP projects
└── seed.ts
```

## Architecture (one rule)

```
Page/Component → Action or API Route → lib/ function → D1/KV/R2/YouTube
```

`lib/` has all logic. Actions are thin. Components never import `lib/` directly.

## Key domain concepts

**GCP project pool** — YouTube API quota is charged to the GCP project whose `client_id` was used. Each project ≈ 6 uploads/day. Pool of N projects = N × 6. Accounts are permanently bound to the project that issued their refresh_token.

**Account health** — Accounts die (banned, suspended, captcha-locked). Cron checks every 2h + upload worker checks reactively. 3 strikes → flag. Grace period → auto-delete. Never stalls on a dead account.

**Upload flow** — Video → R2 (presigned) → Queue (1 task per channel) → Worker → YouTube API → links back. Dead channels skipped instantly.

## Skills

| Skill      | File                  | Covers                                          |
| ---------- | --------------------- | ----------------------------------------------- |
| Code       | `SKILL-code.md`       | Error handling, validation, logging, testing    |
| Database   | `SKILL-db.md`         | Schema, IDs, timestamps, encryption, migrations |
| Cloudflare | `SKILL-cloudflare.md` | Bindings, Workers limits, KV, Queues, Crons     |
| UI         | `SKILL-ui.md`         | Components, styling, forms, pages               |
| YouTube    | `SKILL-youtube.md`    | Quota, tokens, OAuth gotchas                    |
