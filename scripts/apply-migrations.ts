#!/usr/bin/env npx ts-node
/**
 * Migration Runner Script
 * Applies SQL migrations to Supabase using the Management API
 *
 * Usage: npx ts-node scripts/apply-migrations.ts
 *
 * Required environment variables:
 * - SUPABASE_PROJECT_ID: Your Supabase project ID
 * - SUPABASE_ACCESS_TOKEN: Your Supabase access token (from dashboard)
 * - SUPABASE_DB_PASSWORD: Your database password (from project settings)
 */

import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_PROJECT_ID || !SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_PROJECT_ID) console.error('  - SUPABASE_PROJECT_ID');
  if (!SUPABASE_ACCESS_TOKEN) console.error('  - SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, '../infra/supabase/migrations');

// Migrations to apply (in order)
const MIGRATIONS_TO_APPLY = [
  '003_routing_telemetry.sql',
  '004_memory_v2.sql',
  '005_telemetry_events.sql',
];

async function executeSql(sql: string, migrationName: string): Promise<boolean> {
  const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Migration ${migrationName} failed:`, errorText);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Migration ${migrationName} applied successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error applying ${migrationName}:`, error);
    return false;
  }
}

async function applyMigrations() {
  console.log('🚀 Starting migration process...\n');
  console.log(`📁 Migrations directory: ${MIGRATIONS_DIR}`);
  console.log(`🎯 Project ID: ${SUPABASE_PROJECT_ID}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const migrationFile of MIGRATIONS_TO_APPLY) {
    const filePath = path.join(MIGRATIONS_DIR, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.error(`⚠️ Migration file not found: ${filePath}`);
      failCount++;
      continue;
    }

    console.log(`📄 Applying: ${migrationFile}`);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const success = await executeSql(sql, migrationFile);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    console.log('');
  }

  console.log('─'.repeat(50));
  console.log(`📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Total: ${MIGRATIONS_TO_APPLY.length}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

applyMigrations().catch(console.error);
