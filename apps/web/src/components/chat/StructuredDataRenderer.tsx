'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Table, List, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StructuredDataRendererProps {
  data: unknown;
  maxDepth?: number;
  className?: string;
}

/**
 * Detect the type of data for appropriate rendering
 */
function detectDataType(data: unknown): 'table' | 'tree' | 'primitive' | 'empty' {
  if (data === null || data === undefined) return 'empty';
  if (typeof data !== 'object') return 'primitive';
  if (Array.isArray(data)) {
    if (data.length === 0) return 'empty';
    // Check if it's an array of objects with consistent keys (table-like)
    if (data.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
      const firstKeys = Object.keys(data[0] as object).sort().join(',');
      const allSameShape = data.every(item =>
        Object.keys(item as object).sort().join(',') === firstKeys
      );
      if (allSameShape && firstKeys.length > 0) return 'table';
    }
    return 'tree';
  }
  if (Object.keys(data).length === 0) return 'empty';
  return 'tree';
}

/**
 * Format a primitive value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') {
    // Check if it's a URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    // Truncate long strings
    if (value.length > 100) {
      return value.slice(0, 100) + '...';
    }
    return value;
  }
  return String(value);
}

/**
 * Get column headers from an array of objects
 */
function getTableColumns(data: Record<string, unknown>[]): string[] {
  if (data.length === 0) return [];
  const first = data[0];
  if (!first) return [];
  // Prioritize common meaningful columns
  const priorityColumns = ['id', 'name', 'title', 'type', 'status', 'date', 'created_at', 'updated_at'];
  const allKeys = Object.keys(first);
  const sorted = allKeys.sort((a, b) => {
    const aIndex = priorityColumns.indexOf(a.toLowerCase());
    const bIndex = priorityColumns.indexOf(b.toLowerCase());
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });
  // Limit to 6 columns for readability
  return sorted.slice(0, 6);
}

/**
 * Table renderer for arrays of objects
 */
function TableRenderer({ data, className }: { data: Record<string, unknown>[]; className?: string }) {
  const columns = useMemo(() => getTableColumns(data), [data]);
  const [showAll, setShowAll] = useState(false);
  const displayData = showAll ? data : data.slice(0, 5);
  const hasMore = data.length > 5;

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-1.5 text-left text-text-muted font-medium capitalize"
              >
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border-subtle/50 hover:bg-surface-3/50 transition-colors"
            >
              {columns.map((col) => (
                <td key={col} className="px-2 py-1.5 text-text-secondary">
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
        >
          {showAll ? (
            <>Show less ({data.length - 5} hidden)</>
          ) : (
            <>Show {data.length - 5} more rows</>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Tree renderer for nested objects
 */
function TreeNode({
  keyName,
  value,
  depth,
  maxDepth
}: {
  keyName?: string;
  value: unknown;
  depth: number;
  maxDepth: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const isObject = typeof value === 'object' && value !== null;
  const isArray = Array.isArray(value);
  const isEmpty = isObject && Object.keys(value).length === 0;
  const isDeep = depth >= maxDepth;

  // For primitives or max depth, just show the value
  if (!isObject || isEmpty || isDeep) {
    return (
      <div className="flex items-start gap-2 py-0.5">
        {keyName && (
          <span className="text-neon-primary font-medium shrink-0">{keyName}:</span>
        )}
        <span className={cn(
          'text-text-secondary break-all',
          typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))
            ? 'text-blue-400 hover:underline cursor-pointer'
            : ''
        )}>
          {isEmpty ? (isArray ? '[]' : '{}') : formatValue(value)}
        </span>
      </div>
    );
  }

  const entries = Object.entries(value);
  const label = isArray ? `[${entries.length}]` : `{${entries.length}}`;

  return (
    <div className="py-0.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 hover:bg-surface-3/50 rounded px-1 -ml-1 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3 text-text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 text-text-muted" />
        )}
        {keyName && (
          <span className="text-neon-primary font-medium">{keyName}</span>
        )}
        <span className="text-text-muted text-xs">{label}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="ml-4 pl-2 border-l border-border-subtle overflow-hidden"
          >
            {entries.map(([k, v]) => (
              <TreeNode
                key={k}
                keyName={k}
                value={v}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * StructuredDataRenderer Component
 *
 * Intelligently renders structured data:
 * - Arrays of objects with consistent keys -> Table view
 * - Nested objects -> Collapsible tree view
 * - Primitives -> Formatted text
 */
export function StructuredDataRenderer({
  data,
  maxDepth = 4,
  className
}: StructuredDataRendererProps) {
  const dataType = useMemo(() => detectDataType(data), [data]);

  if (dataType === 'empty') {
    return (
      <div className={cn('text-text-muted text-xs italic', className)}>
        No data
      </div>
    );
  }

  if (dataType === 'primitive') {
    return (
      <div className={cn('text-text-secondary text-xs whitespace-pre-wrap break-words', className)}>
        {formatValue(data)}
      </div>
    );
  }

  if (dataType === 'table') {
    return (
      <div className={className}>
        <div className="flex items-center gap-1.5 mb-2 text-text-muted">
          <Table className="h-3 w-3" />
          <span className="text-xs">{(data as unknown[]).length} items</span>
        </div>
        <TableRenderer data={data as Record<string, unknown>[]} />
      </div>
    );
  }

  // Tree view for nested objects
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 mb-2 text-text-muted">
        {Array.isArray(data) ? (
          <>
            <List className="h-3 w-3" />
            <span className="text-xs">{(data as unknown[]).length} items</span>
          </>
        ) : (
          <>
            <FileJson className="h-3 w-3" />
            <span className="text-xs">Object</span>
          </>
        )}
      </div>
      <div className="text-xs font-mono">
        <TreeNode value={data} depth={0} maxDepth={maxDepth} />
      </div>
    </div>
  );
}

StructuredDataRenderer.displayName = 'StructuredDataRenderer';
