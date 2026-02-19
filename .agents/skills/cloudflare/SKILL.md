---
name: cloudflare
description: Conventions and best practices for working with Cloudflare Workers, D1, R2, KV, and Queues in this project.
---

# Cloudflare Conventions

## Accessing bindings

Use `getCloudflareContext()` from `@opennextjs/cloudflare`. Never hardcode connection strings.

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDb() {
  const { env } = await getCloudflareContext();
  return drizzle(env.DB);
}
```

## Bindings (wrangler.jsonc)

| Binding        | Type  | Usage                                          |
| -------------- | ----- | ---------------------------------------------- |
| `DB`           | D1    | Primary database                               |
| `VIDEOS`       | R2    | Temp video staging (auto-cleaned after upload) |
| `LOGS`         | R2    | Log archive (Logpush destination)              |
| `CACHE`        | KV    | Quota counters, access token cache             |
| `UPLOAD_QUEUE` | Queue | Upload task processing                         |

## Secrets

In `.dev.vars` (local) and `wrangler secret put` (prod):

```
ENCRYPTION_KEY=         # 256-bit hex for AES-256-GCM
NEXTAUTH_SECRET=        # JWT signing
SENTRY_DSN=             # optional
```

## Workers limits

- **CPU time:** 30s per request. Resumable uploads must chunk within this.
- **Body size:** 100MB. Videos go browser → R2 via presigned URL, never through Workers.
- **No Node.js APIs:** No `fs`, `path`, `process.env`. Use Web APIs + Cloudflare APIs only.

## KV patterns

Quota tracking:

```
Key:   quota:{projectId}:{YYYY-MM-DD}
Value: integer (units consumed)
TTL:   172800 (48h)
```

Token cache:

```
Key:   token:{accountId}
Value: { accessToken, expiresAt }
TTL:   3000 (50 min, tokens last 60 min)
```

Always check KV first. Only call Google's token endpoint on cache miss.

## Queue consumer

Processes one task at a time (`max_batch_size: 1`). Must handle ALL errors — a thrown exception retries the message (up to 5×). Classify errors explicitly: retry vs permanent fail vs flag account.

## Cron handlers

| Cron           | What                                          |
| -------------- | --------------------------------------------- |
| `*/45 * * * *` | Refresh tokens expiring within 10 min         |
| `0 */2 * * *`  | Account health check (~250 accounts/run)      |
| `5 8 * * *`    | Quota reset (midnight PT = 08:05 UTC)         |
| `0 */6 * * *`  | R2 orphan cleanup                             |
| `30 4 * * *`   | Auto-delete accounts past grace period        |
| `0 3 * * *`    | Purge logs (upload_logs >30d, audit_log >90d) |
