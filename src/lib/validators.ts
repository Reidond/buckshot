import { z } from "zod";

export const AddProjectSchema = z.object({
  label: z.string().min(1).max(100),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  gcpProjectId: z.string().optional(),
  maxAccounts: z.number().int().positive().optional(),
});

export const UpdateProjectSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  maxAccounts: z.number().int().positive().nullable().optional(),
});

export const ConnectAccountSchema = z.object({
  projectId: z.string().optional(), // auto-selected if not provided
});

export const CreateUploadJobSchema = z.object({
  title: z.string().min(1).max(100),
  videoR2Key: z.string().min(1),
  videoFilename: z.string().min(1),
  videoSize: z
    .number()
    .int()
    .positive()
    .max(256 * 1024 * 1024), // 256MB
  accountIds: z.array(z.string()).min(1).optional(), // omit = all active accounts
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  privacy: z.enum(["public", "unlisted", "private"]).default("public"),
  templateId: z.string().optional(),
});

export const CreateAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  role: z.enum(["super_admin", "admin"]).default("admin"),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const UpdateAccountSchema = z.object({
  tags: z.array(z.string()).optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const PresignSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().default("video/mp4"),
  size: z
    .number()
    .int()
    .positive()
    .max(256 * 1024 * 1024),
});
