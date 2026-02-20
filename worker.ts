/**
 * Cloudflare Worker entrypoint.
 *
 * Wraps the opennextjs-cloudflare Next.js handler and adds the upload queue consumer.
 * wrangler.jsonc main points here; wrangler bundles this + .open-next/worker.js together.
 */

// @ts-ignore: generated at build time by opennextjs-cloudflare
import nextWorker from "./.open-next/worker.js";
// @ts-ignore: generated at build time
export { DOQueueHandler } from "./.open-next/.build/durable-objects/queue.js";
// @ts-ignore: generated at build time
export { DOShardedTagCache } from "./.open-next/.build/durable-objects/sharded-tag-cache.js";
// @ts-ignore: generated at build time
export { BucketCachePurge } from "./.open-next/.build/durable-objects/bucket-cache-purge.js";

import type { CloudflareEnv, UploadQueueMessage } from "./src/types";
import { processUploadMessage } from "./src/lib/queue/consumer";

export default {
  fetch: nextWorker.fetch.bind(nextWorker) as typeof nextWorker.fetch,

  async queue(batch: MessageBatch<UploadQueueMessage>, env: CloudflareEnv): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processUploadMessage(message, env);
      } catch (err) {
        console.error(`[queue] unhandled error for message ${message.id}`, err);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv, UploadQueueMessage>;
