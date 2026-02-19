import type { CloudflareEnv } from "@/types";

export interface UploadQueueMessage {
  taskId: string;
  jobId: string;
  accountId: string;
}

export async function processUploadMessage(
  message: Message<UploadQueueMessage>,
  env: CloudflareEnv
): Promise<void> {
  const { taskId, jobId, accountId } = message.body;
  console.log(`[queue] processing upload task ${taskId} (job=${jobId}, account=${accountId})`);

  // TODO: implement upload processing
  // 1. Load task from DB
  // 2. Check account health → skip dead accounts
  // 3. Fetch video from R2
  // 4. Upload to YouTube via resumable upload
  // 5. Update task status + store YouTube URL
  // 6. Check if all tasks for job are done → update job status

  message.ack();
}
