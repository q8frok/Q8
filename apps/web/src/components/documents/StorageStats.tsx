'use client';

/**
 * StorageStats
 * Collapsible panel showing storage usage and document statistics
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, HardDrive, FileText, Hash, Loader2 } from 'lucide-react';

interface StorageData {
  totalStorageBytes: number;
  totalDocuments: number;
  totalChunks: number;
  totalTokens: number;
  quotaBytes: number;
  usagePercent: number;
  byStatus: Record<string, number>;
  byType: Record<string, { count: number; sizeBytes: number }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function StorageStats() {
  const [stats, setStats] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    if (stats) return; // Only fetch once

    setLoading(true);
    fetch('/api/documents/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded, stats]);

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <HardDrive className="w-4 h-4" />
        Storage
      </button>

      {expanded && (
        <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
            </div>
          ) : stats ? (
            <>
              {/* Usage bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-white/60">
                    {formatBytes(stats.totalStorageBytes)} of {formatBytes(stats.quotaBytes)}
                  </span>
                  <span className="text-white/40">{stats.usagePercent}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stats.usagePercent > 90 ? 'bg-red-400' :
                      stats.usagePercent > 70 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.min(stats.usagePercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold text-white">{stats.totalDocuments}</p>
                  <p className="text-xs text-white/40">Documents</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{stats.totalChunks.toLocaleString()}</p>
                  <p className="text-xs text-white/40">Chunks</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{stats.totalTokens.toLocaleString()}</p>
                  <p className="text-xs text-white/40">Tokens</p>
                </div>
              </div>

              {/* By type */}
              {Object.keys(stats.byType).length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-1">By Type</p>
                  <div className="space-y-1">
                    {Object.entries(stats.byType)
                      .sort((a, b) => b[1].sizeBytes - a[1].sizeBytes)
                      .map(([type, data]) => (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <span className="text-white/60 uppercase">{type}</span>
                          <span className="text-white/40">
                            {data.count} files • {formatBytes(data.sizeBytes)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-white/40 text-center">Failed to load stats</p>
          )}
        </div>
      )}
    </div>
  );
}

export default StorageStats;
