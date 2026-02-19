# SPEC.md — buckshot · YouTube Shorts Multi-Account Uploader

## 1. Overview

A web application that allows multiple admin users to manage a large number of Google/YouTube accounts (1,000-2,000+) and upload YouTube Shorts across all connected channels immediately. The system uses a **pool of admin-owned GCP projects** to distribute YouTube API quota — each project provides ~6 uploads/day, and the pool scales linearly. Accounts are onboarded via a **bulk connect pipeline** that validates each account instantly and auto-filters dead/banned/blocked accounts. Videos are temporarily staged in Cloudflare R2, distributed to selected YouTube channels, and cleaned up automatically.

---

## 2. Decisions Log

| Question               | Decision                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Framework**          | Next.js 15+ (App Router) via OpenNext for Cloudflare                                           |
| **Video source**       | Admin uploads via dashboard                                                                    |
| **Video storage**      | Cloudflare R2 as temporary cache — auto-deleted after uploads complete                         |
| **Upload scheduling**  | No scheduling — immediate upload only                                                          |
| **Number of accounts** | Designed for 1,000-2,000+ Google accounts (many with multiple channels)                        |
| **Account onboarding** | **Bulk connect pipeline** — rapid-fire OAuth with instant validation + auto-skip dead accounts |
| **Notifications**      | In-app browser notifications (Web Notifications API)                                           |
| **Admin auth**         | Multi-admin users supported                                                                    |
| **Database**           | Cloudflare D1                                                                                  |
| **Metadata**           | Title, description, tags per upload with per-account overrides                                 |
| **GCP strategy**       | **Admin-owned GCP project pool** — admin pre-creates N projects, system auto-assigns accounts  |
| **Quota scaling**      | No quota increase requests — scale by adding more projects to the pool                         |

---

## 3. GCP Project Pool Architecture

### 3.1 How it works

YouTube API quota (10,000 units/day, ~6 uploads) is charged to the **GCP project whose OAuth client_id was used**, not the user. By maintaining a pool of GCP projects, each with its own quota, total capacity scales linearly.

```
┌─────────────────────────────────────────────────────┐
│                   GCP Project Pool                   │
│                                                     │
│  Project-1 (client_id_1, secret_1)                  │
│    ├── Account A (refresh_token bound to project-1) │
│    ├── Account B                                    │
│    └── quota: 10,000 units/day → ~6 uploads         │
│                                                     │
│  Project-2 (client_id_2, secret_2)                  │
│    ├── Account C                                    │
│    ├── Account D                                    │
│    └── quota: 10,000 units/day → ~6 uploads         │
│                                                     │
│  Project-N ...                                      │
│    └── quota: 10,000 units/day → ~6 uploads         │
│                                                     │
│  TOTAL: N × ~6 uploads/day                          │
└─────────────────────────────────────────────────────┘
```

### 3.2 Capacity planning

| Projects | Uploads/day | Accounts supported (1 upload/account/day) |
| -------- | ----------- | ----------------------------------------- |
| 10       | ~60         | 60                                        |
| 50       | ~300        | 300                                       |
| 100      | ~600        | 600                                       |
| 200      | ~1,200      | 1,200                                     |
| 350      | ~2,100      | 2,100                                     |

> For 1,000-2,000 channels uploading daily, ~170-350 GCP projects are needed. At ~2 min setup per project via CLI, that's ~6-12 hours of one-time setup.

### 3.3 Account-to-project binding

- An OAuth refresh_token is **permanently bound** to the client_id that issued it.
- Each connected account is assigned to exactly one GCP project at connection time.
- To move an account to a different project, the user must re-authorize (rare — only needed for pool rebalancing).
- Assignment strategy: **least-loaded project** — new accounts are assigned to the project with the fewest active accounts (balances quota evenly).

### 3.4 Admin setup per project (CLI-assisted)

Google has no API for creating OAuth client credentials or configuring consent screens. These steps are unavoidable. However, a CLI tool automates everything it can and guides the admin through the rest:

```bash
bun run pool:add
```

```
🔧 Adding new GCP project to pool...

[AUTO] Creating GCP project "yt-shorts-pool-017"...          ✅ Done
[AUTO] Enabling YouTube Data API v3...                        ✅ Done

── Manual steps (browser opens automatically) ────────────────

[OPEN] OAuth consent screen → console.cloud.google.com/auth/...
  1. Click "GET STARTED"
  2. App name: "YT Shorts Pool 017"     ← copied to clipboard
  3. Support email: select your email
  4. Audience: External → Next → Save

[OPEN] Publish app → Audience tab
  5. Click "PUBLISH APP" → confirm

[OPEN] Create credentials → Credentials page
  6. Create Credentials → OAuth Client ID → Web Application
  7. Redirect URI: https://your-domain.com/api/accounts/callback  ← copied to clipboard
  8. Copy Client ID + Client Secret

  Paste credentials:
  Client ID: ____
  Client Secret: ____

[AUTO] Validating credentials...                              ✅ Valid
[AUTO] Storing encrypted credentials in D1...                 ✅ Done
[AUTO] Project added to pool.                                 ✅

Pool: 17 projects | ~102 uploads/day capacity
```

**What the CLI automates** (requires admin's Google auth via `gcloud` or browser OAuth):

- GCP project creation (Cloud Resource Manager API)
- YouTube Data API enablement (Service Usage API)
- Credential validation after paste
- Encrypted storage in D1

**What remains manual** (~2 minutes per project):

- OAuth consent screen configuration (no API)
- Publishing app Testing → Production (no API)
- OAuth client ID creation (no API)

For 20 projects, total manual effort is ~40 minutes one-time. The CLI can also batch: `bun run pool:add --count 5` creates 5 GCP projects in sequence, opening browser tabs for each.

> **Note on "unverified app" warning:** Published-but-unverified projects show a warning during OAuth consent. Users click "Advanced → Continue" to proceed. This is a one-time step per account and acceptable since the admin controls all projects. To remove the warning, the admin can optionally verify one or more projects with Google (privacy policy + demo video, takes ~1-3 weeks).

### 3.5 Pool management dashboard

The admin dashboard includes a dedicated pool management section:

- **Add project** — paste client_id + client_secret, system validates by making a test API call.
- **Project health** — per-project: quota used/remaining, # accounts assigned, status (active/quota_exhausted/error).
- **Auto-assignment** — toggle between strategies: least-loaded, round-robin, manual.
- **Rebalance** — flag accounts that should be moved to less-loaded projects (requires user re-auth).
- **Alerts** — notify when pool is >80% utilized (hint to add more projects).

---

## 4. Tech Stack

| Layer                         | Technology                      | Notes                                                            |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| **Framework**                 | Next.js 15+ (App Router)        | React 19, Server Components, Server Actions                      |
| **Runtime / Package Manager** | Bun                             | `bun install`, `bun run`, `bun test`                             |
| **Linting & Formatting**      | Biome                           | Replaces ESLint + Prettier                                       |
| **Deployment**                | Cloudflare Workers via OpenNext | [opennext.js.org/cloudflare](https://opennext.js.org/cloudflare) |
| **Database**                  | Cloudflare D1 (SQLite)          | Project pool, account tokens, admin users, upload history, logs  |
| **ORM**                       | Drizzle ORM                     | Type-safe, D1-compatible, lightweight                            |
| **Temp Video Storage**        | Cloudflare R2                   | Temporary staging — purged after upload                          |
| **Log Archive**               | Cloudflare R2 (separate bucket) | Logpush destination                                              |
| **Queue**                     | Cloudflare Queues               | Upload job processing, retry logic                               |
| **KV Store**                  | Cloudflare KV                   | Quota counters, token cache                                      |
| **Cron**                      | Cloudflare Cron Triggers        | Token refresh, quota reset, R2 cleanup, log purge                |
| **Notifications**             | Web Notifications API + SSE     | In-app browser push + real-time dashboard                        |
| **Admin Auth**                | NextAuth.js (Auth.js v5)        | Multi-admin, credentials provider                                |
| **Google Auth**               | Google OAuth 2.0                | Per-project client_id from pool                                  |
| **Error Tracking**            | Sentry (`@sentry/cloudflare`)   | Unhandled exceptions, breadcrumbs                                |
| **UI**                        | Tailwind CSS + shadcn/ui        | Admin dashboard                                                  |
| **Validation**                | Zod                             | All inputs                                                       |

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Admin Dashboard                         │
│                 (Next.js App Router + RSC)                    │
│            Multi-admin auth via NextAuth.js                   │
├──────────────────────────────────────────────────────────────┤
│  Server Actions / API Routes                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────────────────┐  │
│  │  GCP Pool   │ │  Uploads    │ │  Notifications         │  │
│  │  + Accounts │ │  Manager    │ │  (Browser Push + SSE)  │  │
│  └──────┬──────┘ └──────┬──────┘ └───────────┬────────────┘  │
├─────────┼───────────────┼────────────────────┼───────────────┤
│         ▼               ▼                    ▼               │
│  ┌───────────┐  ┌────────────┐  ┌──────────────────┐        │
│  │    D1     │  │     R2     │  │  Web Push API    │        │
│  │ (pool,    │  │  (temp     │  │  Sentry          │        │
│  │  tokens,  │  │   videos)  │  │                  │        │
│  │  logs)    │  │            │  │                  │        │
│  └───────────┘  └─────┬──────┘  └──────────────────┘        │
│                       │                                      │
│                       ▼                                      │
│              ┌─────────────────┐                             │
│              │  CF Queues      │                             │
│              │  (upload jobs)  │                             │
│              └────────┬────────┘                             │
│                       ▼                                      │
│     ┌──────────────────────────────────────────┐             │
│     │  Upload Worker (rate-aware)               │             │
│     │                                          │             │
│     │  For each task:                          │             │
│     │  1. Look up account → get project_id     │             │
│     │  2. Decrypt project's client_secret      │             │
│     │  3. Use project's client_id + account's  │             │
│     │     refresh_token to get access_token    │             │
│     │  4. Upload to YouTube                    │             │
│     │  5. Quota charged to THAT project        │             │
│     │                                          │             │
│     └──────────────────────────────────────────┘             │
│                                                              │
│              ┌─────────────────┐    ┌──────────────────┐     │
│              │  CF Cron        │    │  R2 Log Archive  │     │
│              │  - token refresh│    │  (CF Logpush)    │     │
│              │  - quota reset  │    └──────────────────┘     │
│              │  - R2 cleanup   │                             │
│              │  - log purge    │                             │
│              └─────────────────┘                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Core Features

### 6.1 Admin User Management

- **Multi-admin** — Multiple admin users with role-based access.
- **Auth** — NextAuth.js v5, credentials provider, bcrypt passwords, JWT sessions.
- **Roles** — `super_admin` (manage admins, pool, all features) / `admin` (manage accounts, uploads).
- **Audit trail** — All actions logged in D1.

### 6.2 GCP Project Pool Management

- **Add project** — Admin enters client_id + client_secret via dashboard form. System validates by calling `youtube.channels.list` with a test token or checking the OAuth discovery endpoint.
- **Project metadata stored:**
  - `client_id`, `client_secret` (encrypted), `gcp_project_id` (optional, for reference)
  - `label` (admin-friendly name, e.g. "Pool-01", "Batch-A")
  - `status`: `active` | `disabled` | `error`
  - `max_accounts` (soft cap per project, default: unlimited)
- **Pool health dashboard:**
  - Per-project: quota used today / 10,000, # accounts, # uploads today, status.
  - Pool-wide: total capacity, utilization %, estimated uploads remaining.
  - Alert when pool utilization > 80%.
- **Disable/enable projects** — Disabled projects stop accepting new accounts and new uploads skip them.
- **Project rotation** — If a project's daily quota is exhausted, uploads for its accounts wait until reset (midnight PT). Accounts can't overflow to other projects (token binding).

### 6.3 Account Connection

#### Single connect

```
Admin clicks "Connect Account"
  → System selects least-loaded GCP project
  → OAuth popup opens with that project's client_id
  → Admin logs into Google account, authorizes
  → Callback: instant validation
     1. Exchange code for tokens
     2. channels.list(mine=true) → verify channel exists and is healthy
     3. Check for multiple channels on same account
  → If healthy: save account, show success
  → If banned/blocked: show error, discard tokens
```

#### Multi-channel auto-discovery

After a successful authorization, the system checks if the Google account has additional channels:

```
Account authorized → channel "Shorts1" connected ✅
  → API check: "This account has 3 more channels"
  → Dialog: "Found 3 more channels: @Gaming, @Music, @Vlogs"
           [Connect All]  [Skip]
  → Admin clicks "Connect All"
  → 3 rapid OAuth popups in sequence
     (Google remembers the session — each is just: pick channel → authorize)
  → All 4 channels connected in ~30 seconds
  → Grouped in UI: "tolik@gmail.com (4 channels)"
```

#### Bulk connect (for 100-2000+ accounts)

For large account pools, the dashboard provides a **Bulk Connect** mode — a rapid-fire pipeline that processes accounts one after another with instant validation and automatic filtering of dead accounts.

```
┌──────────────────────────────────────────────────────────┐
│  Bulk Connect Accounts                                    │
│                                                          │
│  A Google login window will open for each account.       │
│  Bad accounts are auto-detected and skipped instantly.   │
│                                                          │
│  [▶ Start Connecting]                [Pause]  [Done]     │
│                                                          │
│  ── Live Feed ─────────────────────────────────────────  │
│                                                          │
│  #1  user1@gmail.com  → ✅ @Shorts1 connected            │
│  #2  user2@gmail.com  → ❌ BANNED (channelSuspended)     │
│  #3  user3@gmail.com  → ❌ TIMEOUT (captcha/phone)       │
│  #4  user4@gmail.com  → ✅ @Clips4 connected             │
│      → found 2 more channels → auto-connecting...        │
│      → ✅ @Gaming4, ✅ @Music4 connected                  │
│  #5  user5@gmail.com  → ❌ NO CHANNEL                    │
│  #6  user6@gmail.com  → ❌ ACCESS BLOCKED                │
│  #7  user7@gmail.com  → ✅ @Daily7 connected             │
│  ...                                                     │
│                                                          │
│  ── Stats ─────────────────────────────────────────────  │
│  Attempted: 147  |  ✅ Good: 63 (89 channels)  |  ❌ 84  │
│  Speed: ~15 accounts/hour                                │
└──────────────────────────────────────────────────────────┘
```

**Per-account flow in bulk mode:**

```
[Next Account] or auto-advance
  ↓
OAuth popup opens → admin logs into Google account
  ↓
  ├─ Login fails (captcha, phone required, disabled account)
  │   → Google never redirects back
  │   → 30-second timeout → mark SKIPPED → auto-open next
  │
  └─ Login succeeds → consent screen → authorize
      ↓
      Callback fires → INSTANT VALIDATION (< 2 seconds):
        1. Exchange code for tokens
        2. channels.list(mine=true)
           ├─ 403 channelSuspended  → ❌ BANNED → discard tokens
           ├─ 403 forbidden         → ❌ BLOCKED → discard tokens
           ├─ 403 youtubeSignup...  → ❌ NO YT ACCESS → discard
           ├─ empty response        → ❌ NO CHANNEL → discard tokens
           └─ 200 + channel data    → ✅ GOOD → save account
        3. If GOOD: check for multiple channels
           └─ auto-connect remaining channels (rapid OAuth popups)
      ↓
      Result shown instantly → auto-open next popup
```

**Bulk connect completion report:**

```
┌──────────────────────────────────────────────────┐
│  Bulk Connect Results                             │
│                                                  │
│  Total attempted:     237                        │
│  ✅ Connected:         89  (142 channels total)  │
│  ❌ Channel banned:    41                        │
│  ❌ No channel:        28                        │
│  ❌ Login failed:      52  (captcha/phone/etc)   │
│  ❌ Access blocked:    19                        │
│  ⏭ Timed out:          8                        │
│                                                  │
│  [Export Report CSV]  [Go to Accounts]           │
└──────────────────────────────────────────────────┘
```

> **Note:** Accounts that fail at Google login (captcha, phone verification) are broken at Google's level — the software cannot fix those. The system detects them via OAuth timeout and skips them instantly so no time is wasted.

#### Cross-account uploads

A GCP project in the pool can serve accounts from **any** Google account. The project provides the OAuth client credentials (quota source), while the user's token determines which channel receives the upload:

```
GCP Project-1 (10,000 units/day)
  ├── user-A@gmail.com → Channel "Alpha"
  ├── user-B@gmail.com → Channel "Beta"
  └── user-A@gmail.com → Channel "Alpha Gaming"  (same email, different channel)
```

- **Scopes:** `youtube.upload`, `youtube.readonly`, `userinfo.email`
- **Token storage:** refresh_token encrypted (AES-256-GCM) in D1. Access tokens cached in KV (50-min TTL).
- **Re-authorization:** If a token is revoked or expired beyond refresh, admin can trigger re-auth (same project, new token).
- **Duplicate detection:** On callback, check if `channel_id` already exists. If so, offer to re-authorize (update token) instead of creating a duplicate.
- **Account health:** `active` | `token_revoked` | `channel_deleted` | `channel_suspended` | `youtube_blocked` | `account_disabled` | `upload_limit` | `error` | `dead` | `disabled`

### 6.4 Shorts Upload Engine

- **Immediate upload** — No scheduling. Admin uploads video → distributes immediately.
- **Upload flow:**
  1. Admin enters title and selects video (validated: MP4, 9:16, ≤60s, ≤256MB).
  2. Video uploaded to R2 via presigned URL (browser → R2 direct).
  3. Admin selects target channels (defaults to "All channels").
  4. System creates one upload_task per channel, enqueues to Cloudflare Queues.
  5. Queue consumer per task:
     - Looks up account → finds assigned GCP project
     - Gets access_token using project's client_id + account's refresh_token
     - Streams video from R2, uploads to YouTube via resumable upload
     - If channel is banned/blocked → skip instantly, flag account, continue to next
     - Quota consumed from that project
  6. After all tasks complete/fail → R2 object deleted.

**Upload UI — deliberately simple:**

```
┌─────────────────────────────────────────────┐
│  Upload Short                                │
│                                             │
│  Title: [_____________________________]     │
│                                             │
│  Video: [drag & drop or browse]             │
│                                             │
│  Upload to:                                 │
│    ◉ All channels (142)                     │
│    ○ Select channels...                     │
│      ─── filter by account ───              │
│      ☑ tolik@gmail.com (4 channels)         │
│      ☑ ivan@gmail.com (2 channels)          │
│      ☐ petro@gmail.com (1 channel)          │
│                                             │
│  [Upload]                                   │
└─────────────────────────────────────────────┘
```

**Results page — links for every channel:**

```
┌─────────────────────────────────────────────────────┐
│  Job #47 — "Funny cat video"          ✅ 45/47 done │
│                                                     │
│  [Copy All Links]                                   │
│                                                     │
│  @TolikShorts    youtu.be/abc123    ✅  [📋 Copy]   │
│  @TolikGaming    youtu.be/def456    ✅  [📋 Copy]   │
│  @TolikMusic     youtu.be/ghi789    ✅  [📋 Copy]   │
│  @BannedChannel  ─                  ❌  suspended   │
│  @IvanClips      youtu.be/jkl012    ✅  [📋 Copy]   │
│  @NoAccess       ─                  ❌  blocked     │
│  ...                                                │
│                                                     │
│  ✅ 45 uploaded  ❌ 2 failed (accounts flagged)      │
└─────────────────────────────────────────────────────┘
```

The "Copy All Links" button copies all successful YouTube URLs to clipboard (one per line), ready for pasting.

- **Job states:** `pending` → `queued` → `uploading` → `completed` | `failed` | `retrying`
- **Per-upload metadata:** Title (100 chars), Description (5000 chars), Tags, Privacy (`public`/`unlisted`/`private`).
- **Per-account overrides** — Optional title/description/tags per account.
- **Template system** — Variables: `{{account_name}}`, `{{account_email}}`, `{{date}}`, `{{index}}`.
- **Video validation:** MP4 (H.264+AAC), 9:16, ≤60s, ≤256MB.

### 6.5 Smart Rate Limit Handling

**Two limits to track:**

**1. YouTube API Quota (per GCP project, pool-wide)**

- 10,000 units/day per project. `videos.insert` ≈ 1,600 units → ~6 uploads/day/project.
- Tracked in KV: `quota:{project_id}:{YYYY-MM-DD}`. Auto-expires 48h.
- Resets at midnight Pacific Time.
- **Pre-flight:** before enqueuing, check if the account's project has ≥ 1,600 units remaining.

**2. YouTube Channel Upload Limit (per channel)**

- Separate from API quota. YouTube limits uploads per channel per 24h.
- Unverified/new channels have stricter limits.
- Error: `403 uploadLimitExceeded`.

**Backoff strategy:**

| Error                       | Action                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `403 quotaExceeded`         | Park task. Mark project `quota_exhausted` for today. Notify admin.                                            |
| `403 uploadLimitExceeded`   | Park task. Mark account `upload_limit`. Notify admin.                                                         |
| `403 channelSuspended`      | Fail permanently. Mark account `channel_suspended`. Cancel queued tasks for account. Start auto-delete timer. |
| `403 youtubeSignupRequired` | Fail permanently. Mark account `youtube_blocked`. Cancel queued tasks for account.                            |
| `403 channelNotFound`       | Fail permanently. Mark account `channel_deleted`. Cancel queued tasks for account. Auto-delete immediately.   |
| `403 forbidden` (generic)   | Fail permanently. Mark account `youtube_blocked`. Trigger health check.                                       |
| `429 Too Many Requests`     | Exponential backoff: 1s → 2s → 4s → … 5 min. Max 10 retries.                                                  |
| `500 / 503`                 | Retry up to 5× with jitter.                                                                                   |
| `401 Unauthorized`          | Refresh token, retry once. If fails → mark account `token_revoked`. Start auto-delete timer.                  |
| `400 Bad Request`           | Fail permanently. Notify admin with error details.                                                            |
| Other                       | Fail after 3 retries. Notify admin.                                                                           |

- **Smart ordering** — When uploading to many accounts, process accounts on least-utilized projects first.
- **Staggering** — 2-3s delay between tasks to avoid burst rate limits.

### 6.6 Account Health Monitoring & Auto-Cleanup

A cron job runs every 2 hours to proactively detect and handle dead accounts.

> **Quota consideration at scale:** `channels.list` costs 1 API unit. With 1,000+ accounts, health checks consume quota from the pool. The cron distributes checks across pool projects (using each account's assigned project), staggers across runs (check ~250 accounts per run if 1,000 total), and prioritizes accounts with recent upload failures. Accounts that uploaded successfully in the last 24h are assumed healthy and skipped.

#### Health check process

```
Cron: account_health_check (every 2 hours)
  │
  For each account where status = 'active':
  │
  ├─ 1. Try token refresh (POST googleapis.com/token)
  │     └─ 401 invalid_grant → token revoked/expired
  │
  ├─ 2. Call channels.list(mine=true) with access_token
  │     ├─ 200 + items[] → channel exists, account healthy ✅
  │     ├─ 200 + empty items[] → channel deleted/not found
  │     ├─ 403 "youtubeSignupRequired" → no YouTube access
  │     ├─ 403 "channelSuspended" → channel terminated
  │     ├─ 403 "accountDisabled" → Google account disabled
  │     ├─ 403 "forbidden" → access blocked (org policy, etc.)
  │     └─ 401 → token permanently invalid
  │
  └─ 3. Update account based on result
```

#### Failure classification & actions

| Error                                     | Status set to       | Action                          | Auto-delete?                |
| ----------------------------------------- | ------------------- | ------------------------------- | --------------------------- |
| Token refresh fails (`invalid_grant`)     | `token_revoked`     | Notify admin. Skip uploads.     | After 7 days                |
| Channel not found (empty response)        | `channel_deleted`   | Notify admin.                   | **Immediate**               |
| `403 youtubeSignupRequired`               | `youtube_blocked`   | Notify admin.                   | After 3 days                |
| `403 channelSuspended`                    | `channel_suspended` | Notify admin.                   | After 7 days                |
| `403 accountDisabled`                     | `account_disabled`  | Notify admin.                   | **Immediate**               |
| `403 forbidden` (generic)                 | `youtube_blocked`   | Notify admin.                   | After 7 days                |
| Repeated upload failures (5+ consecutive) | `error`             | Trigger immediate health check. | After 7 days if check fails |
| Network/transient errors                  | No change           | Retry next cycle. Log warning.  | No                          |

#### Auto-delete behavior

- Accounts are **soft-deleted** (status set to `dead`, excluded from all operations).
- Admin receives a notification before deletion with reason + grace period.
- After grace period, a cleanup cron:
  1. Revokes the refresh token via Google's revoke endpoint (best-effort).
  2. Clears encrypted credentials from D1.
  3. Decrements the project's `account_count`.
  4. Logs audit event: `account_auto_removed` with reason.
- **Admin can override** — manually re-enable an account before the grace period expires (e.g., if suspension is temporary).
- **Configurable** — grace periods and auto-delete toggle in `/settings`.

#### Strike counter

To avoid false positives from transient issues:

- Each health check failure increments `health_strikes` on the account.
- Each successful check resets `health_strikes` to 0.
- Status only changes after **3 consecutive strikes** (= 3 failed checks = ~6 hours).
- Exception: `channel_deleted` and `account_disabled` are acted on immediately (no strikes needed — these are definitive).

#### Upload-triggered health checks

In addition to the cron, the upload worker also triggers health checks reactively:

- If an upload fails with `403 channelSuspended`, `403 forbidden`, `401`, or `channelNotFound`:
  1. Mark the account with the appropriate status immediately.
  2. Cancel remaining queued tasks for this account in the same job.
  3. Notify admin.
  4. Start the auto-delete grace period.

### 6.7 In-App Browser Notifications

- **Web Notifications API** — Browser-native push. Permission requested on first login.
- **Service Worker** — Background notification delivery.
- **SSE** — Real-time dashboard updates. Falls back to polling.
- **Events:**

  | Event                               | Severity    |
  | ----------------------------------- | ----------- |
  | Upload completed (per job)          | ✅ Info     |
  | Upload failed (after retries)       | ❌ Error    |
  | Project quota exhausted             | ⚠️ Warning  |
  | Channel upload limit reached        | ⚠️ Warning  |
  | Account token expired / revoked     | 🔴 Critical |
  | All projects quota exhausted        | 🔴 Critical |
  | Batch complete                      | ✅ Info     |
  | Pool utilization > 80%              | ⚠️ Warning  |
  | Account channel suspended           | 🔴 Critical |
  | Account channel deleted             | 🔴 Critical |
  | Account YouTube access blocked      | ⚠️ Warning  |
  | Account scheduled for auto-deletion | ⚠️ Warning  |
  | Account auto-deleted                | ❌ Error    |

- **Notification center** — In-dashboard panel with history, read/unread, severity filter.

### 6.7 Admin Dashboard

| Page                | Description                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `/`                 | Overview: pool utilization, total accounts/channels, uploads today, quota summary, activity feed     |
| `/pool`             | **GCP project pool**: add/remove/disable projects, per-project quota + account count                 |
| `/pool/[id]`        | Project detail: accounts assigned, quota graph, daily uploads, status                                |
| `/accounts`         | Account list: grouped by email, health status, channel info, bulk actions                            |
| `/accounts/connect` | **Single connect**: OAuth flow for one account + multi-channel auto-discovery                        |
| `/accounts/bulk`    | **Bulk connect**: rapid-fire pipeline for 100-2000 accounts, live validation feed, completion report |
| `/accounts/[id]`    | Account detail: channel info, project assignment, upload history, re-auth                            |
| `/upload`           | Upload form: title + video + select channels (default: all) → one-click upload                       |
| `/jobs`             | Job list: status, progress, per-channel breakdown, retry                                             |
| `/jobs/[id]`        | Job detail: per-channel task status, YouTube links with copy-all, error logs, retry                  |
| `/templates`        | Metadata templates CRUD                                                                              |
| `/logs`             | Log viewer: filterable by job, account, project, severity, date                                      |
| `/admins`           | Admin user management (super_admin only)                                                             |
| `/settings`         | App settings, notification preferences, auto-delete grace periods                                    |

---

## 7. Data Models (Drizzle Schema)

### 7.1 `admin_users`

```sql
CREATE TABLE admin_users (
  id             TEXT PRIMARY KEY,     -- nanoid
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,        -- bcrypt
  name           TEXT,
  role           TEXT DEFAULT 'admin', -- super_admin | admin
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
```

### 7.2 `gcp_projects` (THE POOL)

```sql
CREATE TABLE gcp_projects (
  id             TEXT PRIMARY KEY,     -- nanoid
  label          TEXT NOT NULL,        -- admin-friendly name ("Pool-01")
  gcp_project_id TEXT,                 -- optional, for reference only
  client_id      TEXT NOT NULL,        -- OAuth client ID
  client_secret  TEXT NOT NULL,        -- encrypted (AES-256-GCM)
  status         TEXT DEFAULT 'active', -- active | disabled | error
  max_accounts   INTEGER,             -- soft cap (NULL = unlimited)
  account_count  INTEGER DEFAULT 0,   -- denormalized counter
  added_by       TEXT REFERENCES admin_users(id),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
```

### 7.3 `google_accounts`

```sql
CREATE TABLE google_accounts (
  id               TEXT PRIMARY KEY,     -- nanoid
  project_id       TEXT NOT NULL REFERENCES gcp_projects(id), -- assigned pool project
  email            TEXT NOT NULL,
  channel_id       TEXT,
  channel_title    TEXT,
  refresh_token    TEXT NOT NULL,        -- encrypted (AES-256-GCM)
  status           TEXT DEFAULT 'active', -- active | expired | upload_limit |
                                          -- token_revoked | channel_deleted | channel_suspended |
                                          -- youtube_blocked | account_disabled | error | dead | disabled
  status_reason    TEXT,                 -- human-readable reason for non-active status
  health_strikes   INTEGER DEFAULT 0,   -- consecutive failed health checks (resets on success)
  last_health_check INTEGER,            -- timestamp of last health check
  auto_delete_at   INTEGER,             -- scheduled auto-deletion timestamp (NULL = no pending deletion)
  tags             TEXT,                 -- JSON array for grouping
  added_by         TEXT REFERENCES admin_users(id),
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
```

### 7.4 `bulk_connect_results`

Tracks each attempt during a bulk connect session for reporting and CSV export.

```sql
CREATE TABLE bulk_connect_results (
  id              TEXT PRIMARY KEY,     -- nanoid
  session_id      TEXT NOT NULL,        -- groups results from one bulk session
  email           TEXT,                 -- Google email (NULL if login failed before we got it)
  channel_id      TEXT,                 -- YouTube channel ID (NULL if validation failed)
  channel_title   TEXT,
  result          TEXT NOT NULL,        -- connected | banned | no_channel | blocked |
                                        --   no_yt_access | login_timeout | error
  error_detail    TEXT,                 -- specific error message
  account_id      TEXT,                 -- FK to google_accounts if connected
  created_by      TEXT REFERENCES admin_users(id),
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_bcr_session ON bulk_connect_results(session_id);
```

### 7.5 `upload_jobs`

```sql
CREATE TABLE upload_jobs (
  id              TEXT PRIMARY KEY,
  video_r2_key    TEXT NOT NULL,
  video_filename  TEXT NOT NULL,
  video_size      INTEGER NOT NULL,    -- bytes
  title           TEXT NOT NULL,
  description     TEXT,
  tags            TEXT,                -- JSON array
  privacy         TEXT DEFAULT 'public',
  template_id     TEXT REFERENCES templates(id),
  created_by      TEXT REFERENCES admin_users(id),
  status          TEXT DEFAULT 'pending', -- pending | processing | completed | partial | failed
  total_tasks     INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks    INTEGER DEFAULT 0,
  r2_cleaned      INTEGER DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
```

### 7.6 `upload_tasks`

```sql
CREATE TABLE upload_tasks (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL REFERENCES upload_jobs(id),
  account_id      TEXT NOT NULL REFERENCES google_accounts(id),
  status          TEXT DEFAULT 'pending', -- pending | queued | uploading | completed | failed | retrying
  title_override  TEXT,
  desc_override   TEXT,
  tags_override   TEXT,                -- JSON array
  youtube_id      TEXT,                -- returned video ID
  youtube_url     TEXT,
  error_message   TEXT,
  error_code      TEXT,
  attempts        INTEGER DEFAULT 0,
  max_attempts    INTEGER DEFAULT 5,
  started_at      INTEGER,
  completed_at    INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
```

### 7.7 `templates`

```sql
CREATE TABLE templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  title           TEXT NOT NULL,       -- supports {{variables}}
  description     TEXT,
  tags            TEXT,                -- JSON array
  privacy         TEXT DEFAULT 'public',
  created_by      TEXT REFERENCES admin_users(id),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
```

### 7.8 `notifications`

```sql
CREATE TABLE notifications (
  id              TEXT PRIMARY KEY,
  admin_id        TEXT REFERENCES admin_users(id), -- NULL = broadcast
  type            TEXT NOT NULL,       -- info | warning | error | critical
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  job_id          TEXT,
  account_id      TEXT,
  project_id      TEXT,
  read            INTEGER DEFAULT 0,
  created_at      INTEGER NOT NULL
);
```

### 7.9 `upload_logs`

```sql
CREATE TABLE upload_logs (
  id              TEXT PRIMARY KEY,
  task_id         TEXT REFERENCES upload_tasks(id),
  job_id          TEXT REFERENCES upload_jobs(id),
  account_id      TEXT REFERENCES google_accounts(id),
  project_id      TEXT REFERENCES gcp_projects(id),
  level           TEXT NOT NULL,       -- debug | info | warn | error
  event           TEXT NOT NULL,       -- token_refresh | upload_start | upload_chunk |
                                       --   upload_complete | quota_check | retry | error |
                                       --   r2_fetch | r2_cleanup | health_check |
                                       --   account_flagged | account_auto_deleted
  message         TEXT NOT NULL,
  metadata        TEXT,                -- JSON
  duration_ms     INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_upload_logs_task ON upload_logs(task_id);
CREATE INDEX idx_upload_logs_job ON upload_logs(job_id);
CREATE INDEX idx_upload_logs_project ON upload_logs(project_id);
CREATE INDEX idx_upload_logs_level ON upload_logs(level, created_at);
```

### 7.10 `audit_log`

```sql
CREATE TABLE audit_log (
  id              TEXT PRIMARY KEY,
  admin_id        TEXT REFERENCES admin_users(id),
  action          TEXT NOT NULL,       -- project_added | project_removed | account_connected |
                                       --   account_removed | account_auto_removed | account_flagged |
                                       --   upload_created | admin_created | etc.
  target_type     TEXT,                -- project | account | job | admin | settings
  target_id       TEXT,
  details         TEXT,                -- JSON
  created_at      INTEGER NOT NULL
);
```

---

## 8. API Routes

```
# Admin Auth
POST   /api/auth/login               — admin login
POST   /api/auth/logout              — admin logout
GET    /api/auth/session             — current session

# Admin Users (super_admin only)
GET    /api/admins                   — list admin users
POST   /api/admins                   — create admin user
DELETE /api/admins/:id               — remove admin user

# GCP Project Pool
GET    /api/pool                     — list all projects with quota stats
POST   /api/pool                     — add project (client_id + client_secret)
GET    /api/pool/:id                 — project detail (accounts, quota, health)
PATCH  /api/pool/:id                 — update project (label, status, max_accounts)
DELETE /api/pool/:id                 — remove project (must have 0 accounts)
POST   /api/pool/:id/validate        — test project credentials

# Google Accounts
GET    /api/accounts                 — list accounts (paginated, filterable by project/status/tag/email)
POST   /api/accounts/connect         — initiate OAuth (auto-selects project from pool)
GET    /api/accounts/callback        — OAuth callback (validates channel, stores token, links to project)
POST   /api/accounts/discover        — check if authorized account has additional channels
GET    /api/accounts/:id             — account detail
DELETE /api/accounts/:id             — disconnect (revoke token, decrement project counter)
POST   /api/accounts/:id/reauth      — re-authorize (same project, new token)
POST   /api/accounts/:id/override-delete — cancel pending auto-deletion
PATCH  /api/accounts/:id             — update tags, status
GET    /api/accounts/bulk/report     — export bulk connect results as CSV

# Uploads
POST   /api/uploads/presign          — get R2 presigned URL
POST   /api/uploads                  — create upload job
GET    /api/uploads                  — list jobs (paginated)
GET    /api/uploads/:id              — job detail with per-channel tasks
GET    /api/uploads/:id/links        — all YouTube URLs for a job (copy-all)
POST   /api/uploads/:id/retry        — retry failed tasks
DELETE /api/uploads/:id              — cancel job + cleanup R2

# Templates
GET    /api/templates                — list
POST   /api/templates                — create
PUT    /api/templates/:id            — update
DELETE /api/templates/:id            — delete

# Notifications
GET    /api/notifications            — list (paginated, filterable)
POST   /api/notifications/read       — mark as read
GET    /api/notifications/stream     — SSE real-time updates

# Quota
GET    /api/quota                    — pool-wide quota summary
GET    /api/quota/:projectId         — per-project quota detail

# Logs
GET    /api/logs                     — query upload_logs (filterable)
GET    /api/logs/audit               — query audit_log (super_admin)

# Health
GET    /api/health                   — system health
```

---

## 9. Upload Flow (Detail)

```
  Admin clicks "Upload"
         │
         ▼
  ┌─────────────────────┐
  │ Upload video to R2  │  (presigned URL, browser → R2 direct)
  └────────┬────────────┘
           ▼
  ┌─────────────────────┐
  │ Create upload_job   │  (D1: metadata, R2 key)
  │ + upload_tasks      │  (one per selected account)
  └────────┬────────────┘
           ▼
  ┌───────────────────────────────────┐
  │ For each task:                    │
  │ 1. Lookup account → project_id   │
  │ 2. KV: quota:{project_id}:{date} │
  │    remaining ≥ 1,600?             │
  └──────┬────────────────────┬───────┘
         │ YES                │ NO
         ▼                    ▼
  ┌──────────────┐     Mark task "failed"
  │ Enqueue to   │     (quota_exhausted)
  │ CF Queue     │     Notify admin
  │ (2-3s stagger│
  │  between)    │
  └──────┬───────┘
         ▼
  ┌─────────────────────────────────────┐
  │ Queue Consumer:                      │
  │ 1. Get account's project from D1    │
  │ 2. Decrypt project's client_secret  │
  │ 3. Get access_token:                │
  │    - KV cache hit? → use it         │
  │    - Miss? → POST to Google token   │
  │      endpoint with project's        │
  │      client_id + client_secret      │
  │      + account's refresh_token      │
  │    - Cache new token in KV (50min)  │
  │ 4. Stream video from R2             │
  │ 5. Resumable upload to YouTube      │
  │ 6. Quota charged to project         │
  └──────┬──────────────────────────────┘
         ▼
   ┌─────┴──────┐
   │            │
Success      Error
   │            │
   ▼            ▼
Update D1    Classify:
Log event    ├─ 403 quotaExceeded     → park, mark project exhausted
Increment    ├─ 403 uploadLimitExceed → park, mark account limit
KV quota     ├─ 429                   → requeue, exp backoff
(+1600)      ├─ 500/503              → retry (max 5, jitter)
   │         ├─ 401                   → refresh token, retry once
   │         ├─ 400                   → fail permanently
   │         └─ other                 → fail after 3
   ▼
  ┌──────────────────────┐
  │ All tasks terminal?  │
  └──────┬───────────────┘
         ▼ YES
  ┌──────────────────────┐
  │ Delete R2 object     │
  │ Notify: batch done   │
  └──────────────────────┘
```

---

## 10. Account Connection Flow (Detail)

```
  Admin clicks "Connect Account"
         │
         ▼
  ┌─────────────────────────────────────┐
  │ Select project from pool:           │
  │ - Filter: status = active           │
  │ - Filter: account_count < max       │
  │ - Sort: account_count ASC           │
  │ - Pick first (least loaded)         │
  └──────┬──────────────────────────────┘
         ▼
  ┌─────────────────────────────────────┐
  │ Build OAuth URL with:               │
  │ - client_id from selected project   │
  │ - redirect_uri: /api/accounts/cb    │
  │ - scope: youtube.upload,            │
  │          youtube.readonly,          │
  │          userinfo.email             │
  │ - state: { project_id, admin_id }   │
  │ - access_type: offline              │
  │ - prompt: consent                   │
  └──────┬──────────────────────────────┘
         ▼
  ┌─────────────────────────────────────┐
  │ User sees Google consent screen     │
  │ (may see "unverified app" warning   │
  │  → click Advanced → Continue)       │
  │                                     │
  │ User authorizes                     │
  └──────┬──────────────────────────────┘
         ▼
  ┌─────────────────────────────────────┐
  │ Callback: /api/accounts/callback    │
  │ 1. Extract code + state             │
  │ 2. Exchange code for tokens using   │
  │    project's client_id + secret     │
  │ 3. Fetch channel info               │
  │ 4. Create google_accounts record    │
  │    (linked to project_id)           │
  │ 5. Encrypt + store refresh_token    │
  │ 6. Cache access_token in KV         │
  │ 7. Increment project account_count  │
  │ 8. Log audit event                  │
  └─────────────────────────────────────┘
```

---

## 11. R2 Temporary Storage

- **Upload:** Browser → R2 direct via presigned URL.
- **Presigned URL expiry:** 1 hour.
- **Lifecycle:** Created → streamed to YouTube by tasks → deleted when all tasks terminal.
- **Orphan cleanup cron:** Every 6h, delete objects > 24h with no active job.
- **Safety net:** R2 lifecycle rule auto-deletes objects > 7 days.

---

## 12. Logging Strategy

### Three tiers

```
┌──────────────────────────────────────────────┐
│              Application Code                │
├──────────────┬──────────────┬────────────────┤
│      D1      │  console.log │    Sentry      │
│  upload_logs │       ▼      │  .captureExcep │
│  audit_log   │  CF Logpush  │                │
│              │       ▼      │  Alerts +      │
│  Queryable   │  R2 bucket   │  stack traces  │
│  in /logs    │  (archive)   │                │
└──────────────┴──────────────┴────────────────┘
```

**Tier 1 — D1 structured logs** (`upload_logs` + `audit_log`): queryable in `/logs` dashboard.
**Tier 2 — CF Logpush → R2**: operational log archive as JSONL. `wrangler tail` for dev.
**Tier 3 — Sentry**: unhandled exceptions with breadcrumbs.

### Retention

| Tier             | Retention | Purge             |
| ---------------- | --------- | ----------------- |
| D1 `upload_logs` | 30 days   | Cron purge        |
| D1 `audit_log`   | 90 days   | Cron purge        |
| R2 log archive   | 90 days   | R2 lifecycle rule |
| Sentry           | Per plan  | Managed           |

---

## 13. Security

- **Credential encryption** — `client_secret` and `refresh_token` encrypted with AES-256-GCM. Key in Worker secrets.
- **Admin auth** — NextAuth.js, bcrypt passwords, JWT sessions.
- **RBAC** — `super_admin` (pool + admins), `admin` (accounts + uploads).
- **CSRF** — Server Actions.
- **Validation** — Zod everywhere.
- **R2** — Private bucket, time-limited presigned URLs.
- **Audit log** — All actions recorded.
- **Sentry** — PII filtered (no tokens in reports).

---

## 14. Project Structure

```
buckshot/
├── biome.json
├── bun.lock
├── package.json
├── next.config.ts
├── open-next.config.ts
├── wrangler.jsonc
├── drizzle.config.ts
├── .dev.vars                       # ENCRYPTION_KEY, SENTRY_DSN
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Dashboard overview
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── pool/
│   │   │   │   ├── page.tsx        # GCP project pool
│   │   │   │   └── [id]/page.tsx   # Project detail
│   │   │   ├── accounts/
│   │   │   │   ├── page.tsx        # Account list (grouped by email)
│   │   │   │   ├── connect/page.tsx # Single connect + multi-channel discovery
│   │   │   │   ├── bulk/page.tsx   # Bulk connect pipeline
│   │   │   │   └── [id]/page.tsx   # Account detail
│   │   │   ├── upload/page.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── templates/page.tsx
│   │   │   ├── logs/page.tsx
│   │   │   ├── admins/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── pool/
│   │       ├── accounts/
│   │       ├── uploads/
│   │       ├── templates/
│   │       ├── notifications/
│   │       ├── quota/
│   │       ├── logs/
│   │       └── health/
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── pool/                   # Project pool cards, forms
│   │   ├── accounts/
│   │   ├── uploads/
│   │   ├── logs/
│   │   ├── notifications/
│   │   └── layout/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts           # Drizzle schema
│   │   │   ├── index.ts
│   │   │   └── migrations/
│   │   ├── pool/
│   │   │   ├── assignment.ts       # Project selection logic
│   │   │   └── health.ts           # Pool health checks
│   │   ├── accounts/
│   │   │   ├── health-check.ts     # Account health monitoring logic
│   │   │   └── auto-cleanup.ts     # Grace period + auto-delete
│   │   ├── youtube/
│   │   │   ├── client.ts           # YouTube API wrapper
│   │   │   ├── upload.ts           # Resumable upload
│   │   │   └── quota.ts            # KV quota tracking (per-project)
│   │   ├── google/
│   │   │   ├── oauth.ts            # OAuth flow (uses pool project credentials)
│   │   │   └── tokens.ts           # Token refresh (project client + account token)
│   │   ├── notifications/
│   │   │   ├── service.ts
│   │   │   ├── sse.ts
│   │   │   └── sw-register.ts
│   │   ├── logging/
│   │   │   ├── logger.ts           # Structured D1 logger
│   │   │   └── sentry.ts
│   │   ├── queue/
│   │   │   └── consumer.ts
│   │   ├── r2/
│   │   │   ├── presign.ts
│   │   │   └── cleanup.ts
│   │   ├── auth/
│   │   │   └── config.ts
│   │   ├── crypto.ts               # AES-256-GCM
│   │   └── validators.ts           # Zod schemas
│   ├── actions/
│   │   ├── pool.ts
│   │   ├── accounts.ts
│   │   ├── uploads.ts
│   │   └── templates.ts
│   ├── hooks/
│   │   ├── use-notifications.ts
│   │   └── use-pool-health.ts
│   ├── types/
│   └── sw.ts
├── public/
│   └── sw.js
└── scripts/
    ├── seed.ts
    ├── create-admin.ts
    └── pool-add.ts                 # CLI: create GCP project + guided setup
```

---

## 15. Cloudflare Bindings (`wrangler.jsonc`)

```jsonc
{
  "name": "buckshot",
  "compatibility_date": "2025-01-01",
  "d1_databases": [
    { "binding": "DB", "database_name": "yt-shorts-db", "database_id": "..." },
  ],
  "r2_buckets": [
    { "binding": "VIDEOS", "bucket_name": "yt-shorts-videos" },
    { "binding": "LOGS", "bucket_name": "yt-shorts-logs" },
  ],
  "kv_namespaces": [{ "binding": "CACHE", "id": "..." }],
  "queues": {
    "producers": [{ "binding": "UPLOAD_QUEUE", "queue": "yt-upload-queue" }],
    "consumers": [
      {
        "queue": "yt-upload-queue",
        "max_retries": 5,
        "max_batch_size": 1,
        "max_batch_timeout": 0,
      },
    ],
  },
  "crons": [
    { "cron": "*/45 * * * *", "description": "Refresh access tokens" },
    { "cron": "0 */2 * * *", "description": "Account health check (every 2h)" },
    {
      "cron": "5 8 * * *",
      "description": "Reset quota counters (midnight PT = 08:05 UTC)",
    },
    { "cron": "0 */6 * * *", "description": "R2 orphan cleanup" },
    {
      "cron": "30 4 * * *",
      "description": "Auto-delete expired accounts (past grace period)",
    },
    { "cron": "0 3 * * *", "description": "Purge old logs" },
  ],
}
```

---

## 16. Development Workflow

```bash
bun install                          # install deps
bun run dev                          # local dev server
bun run check                        # biome lint + format
bun run db:generate                  # drizzle-kit generate
bun run db:migrate:local             # apply to local D1
bun run db:migrate:prod              # apply to remote D1
bun run db:studio                    # drizzle studio
bun run create-admin                 # create first super_admin
bun run pool:add                     # CLI: add GCP project to pool (guided)
bun run pool:add -- --count 5        # CLI: batch add 5 projects
bun run build                        # next build
bun run deploy                       # opennextjs-cloudflare + wrangler deploy
bun test                             # tests
```

---

## 17. MVP Scope

### Phase 1 — MVP

- Multi-admin auth (NextAuth.js)
- **GCP project pool** — add/remove projects via dashboard + CLI (`pool:add`), per-project quota tracking
- **1-click account connection** — auto-assigns to least-loaded project, multi-channel auto-discovery
- **Bulk connect pipeline** — rapid-fire OAuth for 100-2000 accounts with instant validation, auto-skip dead accounts, completion report with CSV export
- **Account health monitoring** — cron-based health checks, strike system, auto-delete dead accounts
- Upload a Short to selected channels (immediate) — title + video + upload to all
- **Links page** — per-job YouTube URLs with copy-all button
- R2 temp staging with auto-cleanup
- Per-project quota tracking (KV) + rate limit handling
- In-app notifications for errors/completions/health alerts
- Structured logging (D1 `upload_logs`)
- Dashboard: pool health, accounts (grouped by email), upload form, jobs, quota

### Phase 2 — Templates & Polish

- Metadata templates with `{{variable}}` interpolation
- Per-account overrides in upload form
- Notification center with history
- Account tags / grouping
- Log viewer page (`/logs`) with filters
- Audit log viewer
- Pool rebalancing tools
- Sentry integration

### Phase 3 — Scale & Analytics

- Bulk upload (multiple videos per batch)
- Pool utilization forecasting + alerts
- YouTube analytics pull (views, likes per Short)
- SSE real-time upload progress
- R2 Logpush archive

---

## 18. Known Constraints

- **Workers body size:** 100 MB limit → solved by presigned R2 upload.
- **Workers CPU time:** 30s per request. Resumable uploads must chunk within this.
- **YouTube API quota:** 10,000 units/day per project. Scale by adding projects to pool. Each project: ~6 uploads/day.
- **YouTube channel upload limit:** Per-channel, rolling 24h. Stricter for new/unverified channels. Not documented precisely.
- **Token-to-project binding:** An account's refresh_token is permanently bound to the GCP project that issued it. Changing projects requires re-authorization.
- **Unverified app warning:** Published-but-unverified projects show a consent screen warning. Users must click through "Advanced → Continue". One-time per account.
- **100 refresh tokens per client_id per Google Account:** If the same Google Account authorizes the same project 100+ times, oldest tokens are revoked. Not an issue in practice (1 account = 1 token).
- **GCP project creation limit:** Free-tier accounts default to ~12 projects. Admin may need to request project quota increase from Google (different from YouTube API quota — this one is easy to get).
- **OpenNext maturity:** Verify compatibility early: middleware, server actions, SSE.
- **D1 limits:** 2 MB rows, 10 GB DB. Implement log purge and job archival at scale.
- **SSE on Workers:** May hit timeout limits. Fallback to polling.
- **Bulk connect speed:** OAuth requires manual login per account (~15-20 seconds each). 1,000 accounts ≈ 4-6 hours of clicking. No workaround — Google requires interactive login.
- **Dead account ratio:** With 1,000-2,000 accounts, expect 30-60% to be unusable (captcha, phone, banned, no channel). Bulk connect filters these instantly.
- **Health check quota cost:** `channels.list` costs 1 unit per call. Health-checking 1,000 active accounts every 2h = 12,000 units/day. Must spread across pool projects to avoid exhausting quota. Consider checking only accounts with recent activity or staggering across cron runs.
- **Multi-channel OAuth:** Each channel on a multi-channel account requires a separate OAuth authorization. Cannot batch — Google requires per-channel consent.
