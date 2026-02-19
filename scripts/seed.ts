#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * Seeds the local D1 database with dev fixtures.
 * Safe to run multiple times — all inserts use INSERT OR IGNORE.
 *
 * Usage: bun run db:seed:local
 */

import { Database } from "bun:sqlite";

const D1_DIR = `${import.meta.dir}/../.wrangler/state/v3/d1/miniflare-D1DatabaseObject`;

function getLocalDb(): Database {
  const files = [...new Bun.Glob("*.sqlite").scanSync(D1_DIR)];
  if (files.length === 0) {
    throw new Error(
      "No local D1 database found. Run 'bun run db:migrate:local' first.",
    );
  }
  return new Database(`${D1_DIR}/${files[0]}`);
}

async function seed() {
  const db = getLocalDb();
  const now = Date.now();

  // ── Admin user ──────────────────────────────────────────────────────────────
  // Fixed UUID so this stays idempotent across seed runs.
  const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
  const passwordHash = await Bun.password.hash("buckshot", {
    algorithm: "bcrypt",
    cost: 10, // lower cost for dev speed
  });

  const inserted = db
    .query(
      `INSERT OR IGNORE INTO admin_users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ADMIN_ID, "admin@buckshot.local", passwordHash, "Dev Admin", "super_admin", now, now);

  if (inserted.changes > 0) {
    console.log("✓ admin@buckshot.local created (super_admin)");
  } else {
    console.log("· admin@buckshot.local already exists, skipped");
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", (err as Error).message ?? err);
  process.exit(1);
});
