#!/usr/bin/env bun
/**
 * CLI to add a GCP project to the pool.
 * Usage: bun run pool:add
 */

import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("=== Add GCP Project to Pool ===\n");
  console.log("Steps:");
  console.log("1. Go to console.cloud.google.com");
  console.log("2. Create OAuth 2.0 credentials (Web Application)");
  console.log("3. Add redirect URI: http://localhost:3000/api/accounts/callback");
  console.log("4. Paste the credentials below\n");

  const label = await prompt("Project label (e.g. Pool-01): ");
  const clientId = await prompt("Client ID: ");
  const clientSecret = await prompt("Client Secret: ");
  const gcpProjectId = await prompt("GCP Project ID (optional): ");

  if (!label || !clientId || !clientSecret) {
    console.error("Label, Client ID, and Client Secret are required.");
    process.exit(1);
  }

  // TODO: encrypt clientSecret with ENCRYPTION_KEY and store to D1
  // For now, output details for manual insertion via dashboard
  const id = crypto.randomUUID();
  const now = Date.now();

  console.log("\nNOTE: Client secret must be encrypted before storage.");
  console.log("Run the app and use POST /api/pool to add via the dashboard instead.");
  console.log("\nProject details captured:");
  console.log({ id, label, clientId, gcpProjectId: gcpProjectId || null, now });

  rl.close();
}

main().catch(console.error);
