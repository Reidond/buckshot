import type { InferSelectModel } from "drizzle-orm";
import type {
  adminUsers,
  gcpProjects,
  googleAccounts,
  notifications,
  templates,
  uploadJobs,
  uploadTasks,
} from "@/lib/db/schema";

// ============ Status Union Types ============

export type AccountStatus =
  | "active"
  | "expired"
  | "upload_limit"
  | "token_revoked"
  | "channel_deleted"
  | "channel_suspended"
  | "youtube_blocked"
  | "account_disabled"
  | "error"
  | "dead"
  | "disabled";

export type ProjectStatus = "active" | "disabled" | "error";

export type UploadJobStatus = "pending" | "processing" | "completed" | "partial" | "failed";

export type UploadTaskStatus =
  | "pending"
  | "queued"
  | "uploading"
  | "completed"
  | "failed"
  | "retrying";

export type NotificationType = "info" | "warning" | "error" | "critical";

export type AdminRole = "super_admin" | "admin";

export type BulkConnectResult =
  | "connected"
  | "banned"
  | "no_channel"
  | "blocked"
  | "no_yt_access"
  | "login_timeout"
  | "error";

export type UploadPrivacy = "public" | "unlisted" | "private";

// ============ Drizzle Inferred Types ============

export type AdminUser = InferSelectModel<typeof adminUsers>;
export type GcpProject = InferSelectModel<typeof gcpProjects>;
export type GoogleAccount = InferSelectModel<typeof googleAccounts>;
export type UploadJob = InferSelectModel<typeof uploadJobs>;
export type UploadTask = InferSelectModel<typeof uploadTasks>;
export type Notification = InferSelectModel<typeof notifications>;
export type Template = InferSelectModel<typeof templates>;

// ============ Queue Messages ============

export type { UploadQueueMessage } from "@/lib/queue/consumer";

// ============ Cloudflare Env ============

export interface CloudflareEnv {
  DB: D1Database;
  VIDEOS: R2Bucket;
  LOGS: R2Bucket;
  CACHE: KVNamespace;
  UPLOAD_QUEUE: Queue;
  ENCRYPTION_KEY: string;
  NEXTAUTH_SECRET: string;
  SENTRY_DSN?: string;
}
