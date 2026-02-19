---
name: code
description: Conventions and best practices for writing code in this project, including error handling, validation, logging, and testing.
---

# Code Patterns

## Error handling

Use typed results for expected business errors. Reserve `throw` for unexpected errors (goes to Sentry).

```typescript
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };
```

## Validation

All external input validated with Zod. Schemas live in `src/lib/validators.ts` for reuse across actions and API routes.

```typescript
export const createUploadSchema = z.object({
  title: z.string().min(1).max(100),
  accountIds: z.array(z.string()).min(1),
  privacy: z.enum(["public", "unlisted", "private"]).default("public"),
});
```

Validate on both client (feedback) and server (security).

## Structured logging

Use the D1 logger for upload events — not `console.log`:

```typescript
import { log } from "@/lib/logging/logger";

await log({
  level: "info",
  event: "upload_complete",
  message: `Uploaded to ${channelTitle}`,
  taskId,
  jobId,
  accountId,
  projectId,
  metadata: { youtubeId, durationMs: elapsed },
});
```

Valid events: `token_refresh` · `upload_start` · `upload_chunk` · `upload_complete` · `quota_check` · `retry` · `error` · `r2_fetch` · `r2_cleanup` · `health_check` · `account_flagged` · `account_auto_deleted`

## Audit logging

All admin actions go to `audit_log`:

```typescript
await audit({
  adminId: session.user.id,
  action: "account_connected",
  targetType: "account",
  targetId: account.id,
  details: { email: account.email, projectId: account.projectId },
});
```

## Testing

```bash
bun test                       # all tests
bun test src/lib/pool          # specific dir
bun test --watch               # watch mode
```

- Test files: `*.test.ts` co-located with source
- `bun:test` runner (vitest-compatible API)
- Focus on `lib/` business logic
- Mock Cloudflare bindings with miniflare or manual mocks

## Do NOT

- Log tokens, secrets, or encryption keys
- Use `console.log` for structured events
- Retry `400 Bad Request` (permanent)
- Skip Zod validation on any external input
- Assume accounts are healthy — always handle auth/channel errors
