import { NextRequest, NextResponse } from 'next/server';
import { normalizeMerchantName } from '@/lib/finance/categoryMatcher';
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from '@/lib/auth/api-auth';
import { errorResponse, notFoundResponse } from '@/lib/api/error-responses';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/finance/category-rules
 * Fetch all category rules for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let query = supabase
      .from('finance_category_rules')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false })
      .order('hit_count', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Supabase error', { error });
      return errorResponse(error.message, 500);
    }

    // Transform snake_case to camelCase
    const rules = data.map((rule) => ({
      id: rule.id,
      userId: rule.user_id,
      merchantPattern: rule.merchant_pattern,
      normalizedPattern: rule.normalized_pattern,
      matchType: rule.match_type,
      category: rule.category,
      sourceTransactionId: rule.source_transaction_id,
      hitCount: rule.hit_count,
      isActive: rule.is_active,
      priority: rule.priority,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    }));

    return NextResponse.json({ rules });
  } catch (error) {
    logger.error('Fetch category rules error', { error });
    return errorResponse('Failed to fetch category rules', 500);
  }
}

/**
 * POST /api/finance/category-rules
 * Create a new category rule for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }
    const userId = user.id;

    const body = await request.json();
    const {
      merchantPattern,
      matchType = 'contains',
      category,
      sourceTransactionId,
      priority = 0,
    } = body;

    if (!merchantPattern || !category) {
      return errorResponse('Missing required fields: merchantPattern, category', 400);
    }

    const normalizedPattern = normalizeMerchantName(merchantPattern);

    if (!normalizedPattern) {
      return errorResponse('Invalid merchant pattern', 400);
    }

    const { data, error } = await supabase
      .from('finance_category_rules')
      .insert({
        user_id: userId,
        merchant_pattern: merchantPattern,
        normalized_pattern: normalizedPattern,
        match_type: matchType,
        category,
        source_transaction_id: sourceTransactionId || null,
        priority,
        is_active: true,
        hit_count: 0,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate rule
      if (error.code === '23505') {
        return errorResponse('A rule with this pattern already exists', 409, 'CONFLICT');
      }
      logger.error('Supabase insert error', { error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      id: data.id,
      userId: data.user_id,
      merchantPattern: data.merchant_pattern,
      normalizedPattern: data.normalized_pattern,
      matchType: data.match_type,
      category: data.category,
      sourceTransactionId: data.source_transaction_id,
      hitCount: data.hit_count,
      isActive: data.is_active,
      priority: data.priority,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    logger.error('Create category rule error', { error });
    return errorResponse('Failed to create category rule', 500);
  }
}

/**
 * PUT /api/finance/category-rules
 * Update an existing category rule (must belong to authenticated user)
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return errorResponse('Rule ID required', 400);
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('finance_category_rules')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return notFoundResponse('Rule');
    }

    if (existing.user_id !== user.id) {
      return errorResponse('Access denied', 403, 'FORBIDDEN');
    }

    // Transform camelCase to snake_case for update
    const dbUpdates: Record<string, unknown> = {};

    if (updates.merchantPattern !== undefined) {
      dbUpdates.merchant_pattern = updates.merchantPattern;
      dbUpdates.normalized_pattern = normalizeMerchantName(updates.merchantPattern);
    }
    if (updates.matchType !== undefined) dbUpdates.match_type = updates.matchType;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;

    const { data, error } = await supabase
      .from('finance_category_rules')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Supabase update error', { error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({
      id: data.id,
      userId: data.user_id,
      merchantPattern: data.merchant_pattern,
      normalizedPattern: data.normalized_pattern,
      matchType: data.match_type,
      category: data.category,
      sourceTransactionId: data.source_transaction_id,
      hitCount: data.hit_count,
      isActive: data.is_active,
      priority: data.priority,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    logger.error('Update category rule error', { error });
    return errorResponse('Failed to update category rule', 500);
  }
}

/**
 * DELETE /api/finance/category-rules
 * Delete a category rule (must belong to authenticated user)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user from session
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Rule ID required', 400);
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('finance_category_rules')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return notFoundResponse('Rule');
    }

    if (existing.user_id !== user.id) {
      return errorResponse('Access denied', 403, 'FORBIDDEN');
    }

    const { error } = await supabase
      .from('finance_category_rules')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Supabase delete error', { error });
      return errorResponse(error.message, 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete category rule error', { error });
    return errorResponse('Failed to delete category rule', 500);
  }
}
