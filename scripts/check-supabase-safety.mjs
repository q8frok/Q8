#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), 'apps/web/.env.local');

function parseEnv(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function fail(msg) {
  console.error(`❌ Supabase safety check failed: ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

if (!fs.existsSync(envPath)) {
  fail(`Missing ${envPath}`);
}

const env = parseEnv(fs.readFileSync(envPath, 'utf8'));

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PROJECT_ID',
];

for (const key of required) {
  if (!env[key]) fail(`Required key missing/empty: ${key}`);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const projectId = env.SUPABASE_PROJECT_ID;
const host = new URL(url).hostname; // <ref>.supabase.co
const urlRef = host.split('.')[0];

if (urlRef !== projectId) {
  fail(`SUPABASE_PROJECT_ID (${projectId}) does not match URL ref (${urlRef})`);
}

const prodRef = env.SUPABASE_PROD_PROJECT_ID || '';
const stagingRef = env.SUPABASE_STAGING_PROJECT_ID || '';

if (!prodRef) {
  warn('SUPABASE_PROD_PROJECT_ID not set. Add it to hard-block local prod usage.');
}
if (!stagingRef) {
  warn('SUPABASE_STAGING_PROJECT_ID not set. Add for stronger environment checks.');
}

if (prodRef && projectId === prodRef) {
  fail(`Local env is pointed at PRODUCTION project (${projectId}).`);
}

if (prodRef && url.includes(`${prodRef}.supabase.co`)) {
  fail('Local Supabase URL points at production ref.');
}

console.log('✅ Supabase safety check passed');
console.log(`   Active local project: ${projectId}`);
if (stagingRef && projectId === stagingRef) {
  console.log('   Mode: STAGING-linked local environment');
} else {
  console.log('   Mode: DEV/other non-production environment');
}
