#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * CLI script to create an admin user.
 * Usage: bun run create-admin [--local | --remote] [--yes | -y] [--name <name>]
 *   --local          Target local D1 via bun:sqlite (default)
 *   --remote         Target production D1 via Cloudflare API
 *                    Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID env vars
 *   --yes, -y        Skip confirmation prompt
 *   --name <value>   Provide name non-interactively
 */

import { Database } from "bun:sqlite";

const DB_ID = "62285cc9-46a9-4fd8-b740-3255f1595f0b";
// Absolute path derived from the script location — CWD-independent
const D1_DIR = `${import.meta.dir}/../.wrangler/state/v3/d1/miniflare-D1DatabaseObject`;

const args = process.argv.slice(2);
const isRemote = args.includes("--remote");
const skipConfirm = args.includes("--yes") || args.includes("-y");
const nameArgIdx = args.indexOf("--name");
const nameArg = nameArgIdx !== -1 ? (args[nameArgIdx + 1] ?? "") : null;

// ── Bun-native stdin reader ───────────────────────────────────────────────────

const decoder = new TextDecoder();
let stdinBuffer = "";
let stdinReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

function getStdinReader() {
  if (!stdinReader) stdinReader = Bun.stdin.stream().getReader();
  return stdinReader;
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  const reader = getStdinReader();
  while (true) {
    const nl = stdinBuffer.indexOf("\n");
    if (nl !== -1) {
      const line = stdinBuffer.slice(0, nl).trimEnd();
      stdinBuffer = stdinBuffer.slice(nl + 1);
      return line;
    }
    const { done, value } = await reader.read();
    if (done) {
      const line = stdinBuffer.trimEnd();
      stdinBuffer = "";
      return line;
    }
    stdinBuffer += decoder.decode(value, { stream: true });
  }
}

// ── DB helpers (parameterized — no string escaping) ───────────────────────────

interface AdminRow {
  role: string;
}

interface AdminInsert {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  role: string;
  now: number;
}

function getLocalDb(): Database {
  const files = [...new Bun.Glob("*.sqlite").scanSync(D1_DIR)];
  if (files.length === 0) {
    throw new Error(
      `No local D1 database found. Run 'bun run dev' first to initialize wrangler state.`
    );
  }
  return new Database(`${D1_DIR}/${files[0]}`);
}

function localCheckDuplicate(email: string): AdminRow | null {
  const db = getLocalDb();
  return db
    .query<AdminRow, [string]>("SELECT role FROM admin_users WHERE email = ? LIMIT 1")
    .get(email);
}

function localInsert(p: AdminInsert): void {
  const db = getLocalDb();
  db.run(
    `INSERT INTO admin_users (id, email, password_hash, name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.email, p.passwordHash, p.name, p.role, p.now, p.now]
  );
}

async function d1Query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN env var is required for --remote");
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID env var is required for --remote");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );

  const json = (await res.json()) as {
    success: boolean;
    result?: Array<{ results: T[] }>;
    errors?: Array<{ message: string }>;
  };

  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join(", ") ?? "Unknown Cloudflare API error";
    throw new Error(msg);
  }

  return json.result?.[0]?.results ?? [];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const target = isRemote ? "remote (production)" : "local";
  console.log(`=== Create Admin [${target}] ===\n`);

  // Email
  const email = (await prompt("Email: ")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Error: Invalid email address.");
    process.exit(1);
  }

  // Password
  const password = await prompt("Password: ");
  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters.");
    process.exit(1);
  }
  const passwordConfirm = await prompt("Confirm password: ");
  if (password !== passwordConfirm) {
    console.error("Error: Passwords do not match.");
    process.exit(1);
  }

  // Name
  let name: string | null = null;
  if (nameArg !== null) {
    name = nameArg.trim() || null;
  } else {
    const input = (await prompt("Name (optional): ")).trim();
    name = input || null;
  }

  // Role
  let role = "";
  while (true) {
    const input = (await prompt("Role (super_admin/admin) [super_admin]: ")).trim();
    if (input === "") {
      role = "super_admin";
      break;
    } else if (input === "super_admin" || input === "admin") {
      role = input;
      break;
    } else {
      console.error('Invalid role. Must be "super_admin" or "admin".');
    }
  }

  // Duplicate check
  console.log("\nChecking for existing account...");
  let existing: AdminRow | null = null;
  if (isRemote) {
    const rows = await d1Query<AdminRow>("SELECT role FROM admin_users WHERE email = ? LIMIT 1", [
      email,
    ]);
    existing = rows[0] ?? null;
  } else {
    existing = localCheckDuplicate(email);
  }
  if (existing) {
    console.error(`✗ Email already registered with role: ${existing.role}`);
    process.exit(1);
  }

  // Summary
  console.log("\n--- Summary ---");
  console.log(`  Email : ${email}`);
  console.log(`  Name  : ${name ?? "(none)"}`);
  console.log(`  Role  : ${role}`);
  console.log(`  Target: ${target}`);
  console.log("----------------\n");

  if (!skipConfirm) {
    const confirm = await prompt("Proceed? (y/N): ");
    if (confirm !== "y" && confirm !== "Y") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // Insert
  const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });
  const insert: AdminInsert = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    name,
    role,
    now: Date.now(),
  };

  console.log("\nCreating admin...");
  if (isRemote) {
    await d1Query(
      `INSERT INTO admin_users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        insert.id,
        insert.email,
        insert.passwordHash,
        insert.name,
        insert.role,
        insert.now,
        insert.now,
      ]
    );
  } else {
    localInsert(insert);
  }

  console.log("✓ Admin created successfully");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", (err as Error).message ?? err);
  process.exit(1);
});
