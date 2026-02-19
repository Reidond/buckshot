---
name: youtube
description: Conventions and best practices for working with the YouTube API, OAuth flows, quota management, and upload error handling in this project.
---

# YouTube Conventions

## Quota math

| API call                 | Cost         |
| ------------------------ | ------------ |
| `videos.insert`          | 1,600 units  |
| `channels.list`          | 1 unit       |
| Daily budget per project | 10,000 units |
| Uploads per project/day  | ~6           |

Health checks at scale: 1,000 accounts × 1 unit × 12 runs/day = 12,000 units. Spread across pool projects, stagger runs, skip recently-active accounts.

## Token lifecycle

1. User authorizes → Google returns `authorization_code`
2. Exchange code → `refresh_token` + `access_token` (60 min)
3. Cache `access_token` in KV (50 min TTL)
4. On expiry → use `refresh_token` + project's `client_id`/`client_secret` to get new `access_token`

**Critical:** `refresh_token` is permanently bound to the `client_id` that issued it. Cannot use Project-A's credentials to refresh Project-B's token.

## OAuth gotchas

- Google only returns `refresh_token` on first auth. Always set `prompt=consent&access_type=offline`.
- "Unverified app" warning on published-but-unverified projects is expected. Users click "Advanced → Continue".
- `channels.list(mine=true)` returns the channel selected during OAuth, not all channels.
- Multi-channel accounts need separate OAuth per channel.
- Published (not Testing) mode required — Testing tokens expire in 7 days.

## Upload errors

| Error                       | Action                                              |
| --------------------------- | --------------------------------------------------- |
| `403 quotaExceeded`         | Park. Mark project exhausted.                       |
| `403 uploadLimitExceeded`   | Park. Mark account limited.                         |
| `403 channelSuspended`      | Permanent fail. Flag account. Cancel queued tasks.  |
| `403 channelNotFound`       | Permanent fail. Auto-delete account.                |
| `403 youtubeSignupRequired` | Permanent fail. Flag account.                       |
| `403 forbidden`             | Permanent fail. Flag + health check.                |
| `429`                       | Backoff: 1s → 2s → 4s → … 5 min. Max 10 retries.    |
| `500/503`                   | Retry 5× with jitter.                               |
| `401`                       | Refresh token, retry once. If fails → flag account. |
| `400`                       | Permanent fail. Don't retry.                        |

## Resumable uploads

YouTube's resumable upload protocol for videos >5MB:

1. `POST` to initiate → get `upload_url`
2. `PUT` chunks (256KB minimum, except final)
3. On interruption → `PUT` with `Content-Range: bytes */*` to get resume offset
4. Must complete within 24h of initiation

Keep chunks small enough to finish within Workers' 30s CPU limit.
