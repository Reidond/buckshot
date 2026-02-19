import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ============ admin_users ============
export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").notNull().default("admin"), // super_admin | admin
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ============ gcp_projects ============
export const gcpProjects = sqliteTable("gcp_projects", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  gcpProjectId: text("gcp_project_id"),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(), // encrypted AES-256-GCM
  status: text("status").notNull().default("active"), // active | disabled | error
  maxAccounts: integer("max_accounts"),
  accountCount: integer("account_count").notNull().default(0),
  addedBy: text("added_by").references(() => adminUsers.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ============ google_accounts ============
export const googleAccounts = sqliteTable("google_accounts", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => gcpProjects.id),
  email: text("email").notNull(),
  channelId: text("channel_id"),
  channelTitle: text("channel_title"),
  refreshToken: text("refresh_token").notNull(), // encrypted AES-256-GCM
  status: text("status").notNull().default("active"),
  // active | expired | upload_limit | token_revoked | channel_deleted |
  // channel_suspended | youtube_blocked | account_disabled | error | dead | disabled
  statusReason: text("status_reason"),
  healthStrikes: integer("health_strikes").notNull().default(0),
  lastHealthCheck: integer("last_health_check"),
  autoDeleteAt: integer("auto_delete_at"),
  tags: text("tags"), // JSON array
  addedBy: text("added_by").references(() => adminUsers.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ============ bulk_connect_results ============
export const bulkConnectResults = sqliteTable(
  "bulk_connect_results",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    email: text("email"),
    channelId: text("channel_id"),
    channelTitle: text("channel_title"),
    result: text("result").notNull(),
    // connected | banned | no_channel | blocked | no_yt_access | login_timeout | error
    errorDetail: text("error_detail"),
    accountId: text("account_id"),
    createdBy: text("created_by").references(() => adminUsers.id),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    sessionIdx: index("idx_bcr_session").on(table.sessionId),
  })
);

// ============ templates ============
export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(), // supports {{variables}}
  description: text("description"),
  tags: text("tags"), // JSON array
  privacy: text("privacy").notNull().default("public"),
  createdBy: text("created_by").references(() => adminUsers.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ============ upload_jobs ============
export const uploadJobs = sqliteTable("upload_jobs", {
  id: text("id").primaryKey(),
  videoR2Key: text("video_r2_key").notNull(),
  videoFilename: text("video_filename").notNull(),
  videoSize: integer("video_size").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  tags: text("tags"), // JSON array
  privacy: text("privacy").notNull().default("public"),
  templateId: text("template_id").references(() => templates.id),
  createdBy: text("created_by").references(() => adminUsers.id),
  status: text("status").notNull().default("pending"),
  // pending | processing | completed | partial | failed
  totalTasks: integer("total_tasks").notNull().default(0),
  completedTasks: integer("completed_tasks").notNull().default(0),
  failedTasks: integer("failed_tasks").notNull().default(0),
  r2Cleaned: integer("r2_cleaned").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ============ upload_tasks ============
export const uploadTasks = sqliteTable("upload_tasks", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => uploadJobs.id),
  accountId: text("account_id")
    .notNull()
    .references(() => googleAccounts.id),
  status: text("status").notNull().default("pending"),
  // pending | queued | uploading | completed | failed | retrying
  titleOverride: text("title_override"),
  descOverride: text("desc_override"),
  tagsOverride: text("tags_override"), // JSON array
  youtubeId: text("youtube_id"),
  youtubeUrl: text("youtube_url"),
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ============ notifications ============
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").references(() => adminUsers.id), // NULL = broadcast
  type: text("type").notNull(), // info | warning | error | critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  jobId: text("job_id"),
  accountId: text("account_id"),
  projectId: text("project_id"),
  read: integer("read").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

// ============ upload_logs ============
export const uploadLogs = sqliteTable(
  "upload_logs",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => uploadTasks.id),
    jobId: text("job_id").references(() => uploadJobs.id),
    accountId: text("account_id").references(() => googleAccounts.id),
    projectId: text("project_id").references(() => gcpProjects.id),
    level: text("level").notNull(), // debug | info | warn | error
    event: text("event").notNull(),
    // token_refresh | upload_start | upload_chunk | upload_complete |
    // quota_check | retry | error | r2_fetch | r2_cleanup | health_check |
    // account_flagged | account_auto_deleted
    message: text("message").notNull(),
    metadata: text("metadata"), // JSON
    durationMs: integer("duration_ms"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    taskIdx: index("idx_upload_logs_task").on(table.taskId),
    jobIdx: index("idx_upload_logs_job").on(table.jobId),
    projectIdx: index("idx_upload_logs_project").on(table.projectId),
    levelCreatedIdx: index("idx_upload_logs_level").on(table.level, table.createdAt),
  })
);

// ============ audit_log ============
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").references(() => adminUsers.id),
  action: text("action").notNull(),
  // project_added | project_removed | account_connected | account_removed |
  // account_auto_removed | account_flagged | upload_created | admin_created | etc.
  targetType: text("target_type"), // project | account | job | admin | settings
  targetId: text("target_id"),
  details: text("details"), // JSON
  createdAt: integer("created_at").notNull(),
});
