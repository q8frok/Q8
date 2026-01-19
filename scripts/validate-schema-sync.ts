#!/usr/bin/env tsx
/**
 * Schema Validation Script
 * 
 * Validates that RxDB and Supabase schemas are in sync.
 * Run this in CI to catch schema drift before deployment.
 * 
 * Usage:
 *   pnpm tsx scripts/validate-schema-sync.ts
 *   pnpm validate-schemas
 */

import { SCHEMA_REGISTRY, type SchemaName } from '../packages/db-schema';
import { toSnakeCase } from '../apps/web/src/lib/sync/transformers';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Expected Supabase table configurations
 * This should match the actual Supabase schema
 */
const SUPABASE_TABLE_CONFIG: Record<string, {
  primaryKey: string;
  requiredColumns: string[];
  optionalColumns: string[];
  hasRLS: boolean;
  hasRealtime: boolean;
}> = {
  users_sync: {
    primaryKey: 'id',
    requiredColumns: ['id', 'email', 'role', 'created_at', 'updated_at'],
    optionalColumns: ['full_name', 'avatar_url'],
    hasRLS: true,
    hasRealtime: true,
  },
  chat_messages: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'role', 'content', 'created_at'],
    optionalColumns: ['thread_id', 'conversation_id', 'agent_name', 'avatar', 'status', 'tool_executions', 'metadata'],
    hasRLS: true,
    hasRealtime: true,
  },
  threads: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'is_archived', 'created_at', 'updated_at', 'last_message_at'],
    optionalColumns: ['title', 'summary', 'metadata'],
    hasRLS: true,
    hasRealtime: true,
  },
  tasks: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'title', 'status', 'priority', 'sort_order', 'created_at', 'updated_at'],
    optionalColumns: ['description', 'due_date', 'tags', 'project_id', 'parent_task_id', 'estimated_minutes', 'completed_at'],
    hasRLS: true,
    hasRealtime: true,
  },
  notes: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'content', 'is_pinned', 'is_archived', 'is_locked', 'is_daily', 'word_count', 'created_at', 'updated_at', 'last_edited_at'],
    optionalColumns: ['title', 'content_json', 'folder_id', 'daily_date', 'color', 'tags', 'ai_summary', 'ai_action_items', 'archived_at', 'embedding'],
    hasRLS: true,
    hasRealtime: true,
  },
  note_folders: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'name', 'sort_order', 'created_at', 'updated_at'],
    optionalColumns: ['icon', 'color', 'parent_id'],
    hasRLS: true,
    hasRealtime: true,
  },
  agent_memories: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'content', 'memory_type', 'importance', 'access_count', 'decay_factor', 'verification_status', 'created_at', 'updated_at'],
    optionalColumns: ['source_thread_id', 'source_message_id', 'tags', 'keywords', 'expires_at', 'last_accessed_at', 'superseded_by', 'provenance', 'embedding'],
    hasRLS: true,
    hasRealtime: true,
  },
  user_preferences: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'theme', 'updated_at'],
    optionalColumns: ['dashboard_layout', 'preferred_agent'],
    hasRLS: true,
    hasRealtime: true,
  },
  devices: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'name', 'type', 'state', 'updated_at'],
    optionalColumns: ['attributes'],
    hasRLS: true,
    hasRealtime: true,
  },
  knowledge_base: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'content', 'created_at', 'updated_at'],
    optionalColumns: ['embedding', 'metadata'],
    hasRLS: true,
    hasRealtime: true,
  },
  github_prs: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'number', 'title', 'status', 'author', 'repo', 'url', 'created_at', 'updated_at'],
    optionalColumns: [],
    hasRLS: true,
    hasRealtime: true,
  },
  calendar_events: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'title', 'start_time', 'end_time', 'calendar_name', 'created_at', 'updated_at'],
    optionalColumns: ['location', 'meeting_url', 'attendees_count', 'color'],
    hasRLS: true,
    hasRealtime: true,
  },
  sync_checkpoints: {
    primaryKey: 'id',
    requiredColumns: ['id', 'user_id', 'collection_name', 'created_at', 'updated_at'],
    optionalColumns: ['last_pulled_at', 'last_pushed_at', 'server_version'],
    hasRLS: true,
    hasRealtime: false,
  },
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

interface ValidationError {
  collection: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Extract field names from a Zod schema
 */
function getZodSchemaFields(schema: unknown): { required: string[]; optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];

  // Access the shape of the Zod object schema
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  if (!shape) {
    return { required, optional };
  }

  for (const [key, fieldSchema] of Object.entries(shape)) {
    // Check if the field is optional by looking at the schema type
    const isOptionalMethod = (fieldSchema as { isOptional?: () => boolean }).isOptional?.();
    const isOptional = isOptionalMethod ?? 
                       (String(fieldSchema).includes('ZodOptional') ||
                        String(fieldSchema).includes('ZodDefault'));
    
    if (isOptional) {
      optional.push(key);
    } else {
      required.push(key);
    }
  }

  return { required, optional };
}

/**
 * Validate that Zod schema matches expected Supabase table structure
 */
function validateSchemaAlignment(
  collectionName: SchemaName,
  zodSchema: unknown,
  supabaseConfig: typeof SUPABASE_TABLE_CONFIG[string]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const zodFields = getZodSchemaFields(zodSchema);

  // Convert Zod field names to snake_case for comparison
  const zodRequiredSnake = zodFields.required.map(toSnakeCase);
  const zodOptionalSnake = zodFields.optional.map(toSnakeCase);
  const allZodFieldsSnake = [...zodRequiredSnake, ...zodOptionalSnake];

  // Check for missing required fields in Zod schema
  for (const requiredCol of supabaseConfig.requiredColumns) {
    if (!allZodFieldsSnake.includes(requiredCol)) {
      errors.push({
        collection: collectionName,
        field: requiredCol,
        message: `Missing required field in Zod schema: ${requiredCol}`,
        severity: 'error',
      });
    }
  }

  // Check for fields in Zod that don't exist in Supabase config
  const allSupabaseFields = [...supabaseConfig.requiredColumns, ...supabaseConfig.optionalColumns];
  for (const zodField of allZodFieldsSnake) {
    // Skip internal fields
    if (zodField.startsWith('_')) continue;
    
    if (!allSupabaseFields.includes(zodField)) {
      errors.push({
        collection: collectionName,
        field: zodField,
        message: `Field exists in Zod but not in Supabase config: ${zodField}`,
        severity: 'warning',
      });
    }
  }

  // Check for required field mismatches
  for (const zodRequired of zodRequiredSnake) {
    if (supabaseConfig.optionalColumns.includes(zodRequired)) {
      errors.push({
        collection: collectionName,
        field: zodRequired,
        message: `Field is required in Zod but optional in Supabase: ${zodRequired}`,
        severity: 'warning',
      });
    }
  }

  return errors;
}

/**
 * Validate all schemas
 */
function validateAllSchemas(): { errors: ValidationError[]; warnings: ValidationError[] } {
  const allErrors: ValidationError[] = [];

  console.log('🔍 Validating schema alignment...\n');

  for (const [collectionName, zodSchema] of Object.entries(SCHEMA_REGISTRY)) {
    // Map collection name to Supabase table name
    const tableName = collectionName === 'users' ? 'users_sync' : collectionName;
    const supabaseConfig = SUPABASE_TABLE_CONFIG[tableName];

    if (!supabaseConfig) {
      allErrors.push({
        collection: collectionName,
        field: '',
        message: `No Supabase configuration found for collection: ${collectionName}`,
        severity: 'warning',
      });
      continue;
    }

    const errors = validateSchemaAlignment(
      collectionName as SchemaName,
      zodSchema,
      supabaseConfig
    );

    if (errors.length === 0) {
      console.log(`  ✅ ${collectionName}`);
    } else {
      console.log(`  ⚠️  ${collectionName} (${errors.length} issues)`);
    }

    allErrors.push(...errors);
  }

  const errors = allErrors.filter((e) => e.severity === 'error');
  const warnings = allErrors.filter((e) => e.severity === 'warning');

  return { errors, warnings };
}

/**
 * Print validation results
 */
function printResults(errors: ValidationError[], warnings: ValidationError[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60) + '\n');

  if (errors.length > 0) {
    console.log('❌ ERRORS:\n');
    for (const error of errors) {
      console.log(`  [${error.collection}] ${error.message}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    for (const warning of warnings) {
      console.log(`  [${warning.collection}] ${warning.message}`);
    }
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All schemas are in sync!\n');
  }

  console.log('='.repeat(60));
  console.log(`Summary: ${errors.length} errors, ${warnings.length} warnings`);
  console.log('='.repeat(60) + '\n');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('\n📋 Q8 Schema Validation Tool\n');
  console.log('Checking RxDB ↔ Supabase schema alignment...\n');

  const { errors, warnings } = validateAllSchemas();
  printResults(errors, warnings);

  // Exit with error code if there are errors
  if (errors.length > 0) {
    console.log('❌ Schema validation failed. Please fix the errors above.\n');
    process.exit(1);
  }

  console.log('✅ Schema validation passed.\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('Schema validation failed with error:', error);
  process.exit(1);
});
