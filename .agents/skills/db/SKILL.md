---
name: db
description: Conventions and best practices for database schema design, migrations, and interactions in this project.
---

# Database Conventions

## Schema

Single source of truth: `src/lib/db/schema.ts` using Drizzle's SQLite syntax.

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
```

## IDs

All primary keys are `TEXT` using nanoid (21 chars):

```typescript
import { nanoid } from "nanoid";
const id = nanoid();
```

## Timestamps

All timestamps are `INTEGER` (Unix epoch seconds): `Math.floor(Date.now() / 1000)`.

Every mutable table has `created_at` and `updated_at`. Always set `updated_at` on writes.

## Booleans

D1 has no `BOOLEAN` type. Use `INTEGER` (0/1).

## Encrypted fields

`gcp_projects.client_secret` and `google_accounts.refresh_token` are AES-256-GCM encrypted:

```typescript
import { encrypt, decrypt } from "@/lib/crypto";

const ciphertext = await encrypt(plaintext, env.ENCRYPTION_KEY);
const plaintext = await decrypt(ciphertext, env.ENCRYPTION_KEY);
```

**Never** log, return to client, or include in Sentry: `client_secret`, `refresh_token`, `access_token`, `password_hash`, `ENCRYPTION_KEY`.

## Migrations

```bash
# After editing schema.ts:
bun run db:generate        # creates migration file
bun run db:migrate:local   # apply locally
bun run db:migrate:prod    # apply to production
```

Never hand-edit migration files. Always use Drizzle Kit.

## D1 limits

- 2MB max row size — keep JSON columns reasonable
- 10GB max database — implement log purge at scale
- No `ALTER TABLE` for constraints — plan schema carefully
- No concurrent writes to same row — use KV for counters (quota, etc.)
