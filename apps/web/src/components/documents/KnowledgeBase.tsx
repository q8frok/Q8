'use client';

/**
 * KnowledgeBase
 * Full-page document management interface with folder navigation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Code,
  Table,
  File,
  Trash2,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FolderOpen,
  Globe,
  MessageSquare,
  Presentation,
  Image,
  Download,
  GripVertical,
  ArrowUpDown,
  Archive,
  RotateCcw,
  Upload,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { FileUploadZone } from './FileUploadZone';
import { DocumentPreview } from './DocumentPreview';
import { FolderTree } from './FolderTree';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { CreateFolderDialog } from './CreateFolderDialog';
import { StorageStats } from './StorageStats';
import type {
  Document,
  DocumentChunk,
  DocumentSearchResult,
  DocumentScope,
  DocumentVersion,
  FileType,
  FolderTreeNode,
} from '@/lib/documents/types';
import { logger } from '@/lib/logger';

interface KnowledgeBaseProps {
  /** Initial scope filter */
  initialScope?: DocumentScope;
  /** Thread ID for conversation context */
  threadId?: string;
  /** Compact mode for sidebar */
  compact?: boolean;
}

const FILE_TYPE_ICONS: Record<FileType, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  docx: FileText,
  doc: FileText,
  txt: FileText,
  md: FileText,
  csv: Table,
  json: Code,
  xlsx: Table,
  xls: Table,
  code: Code,
  pptx: Presentation,
  ppt: Presentation,
  image: Image,
  other: File,
};

const FILE_TYPE_COLORS: Record<FileType, string> = {
  pdf: 'text-red-400',
  docx: 'text-blue-400',
  doc: 'text-blue-400',
  txt: 'text-gray-400',
  md: 'text-purple-400',
  csv: 'text-green-400',
  json: 'text-yellow-400',
  xlsx: 'text-green-400',
  xls: 'text-green-400',
  code: 'text-cyan-400',
  pptx: 'text-orange-400',
  ppt: 'text-orange-400',
  image: 'text-pink-400',
  other: 'text-gray-400',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return date.toLocaleDateString();
}

export function KnowledgeBase({
  initialScope,
  threadId,
  compact = false,
}: KnowledgeBaseProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<DocumentScope | 'all' | 'archived'>(initialScope || 'all');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'preview' | 'chunks' | 'versions'>('details');
  const [docChunks, setDocChunks] = useState<DocumentChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [searchResults, setSearchResults] = useState<DocumentSearchResult[] | null>(null);
  const [searchMode, setSearchMode] = useState<'name' | 'ai'>('name');
  const [searching, setSearching] = useState(false);

  // Bulk select state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkActing, setBulkActing] = useState(false);

  // Version history state
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Archive state
  const [archiving, setArchiving] = useState(false);

  // Mobile panel state
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Folder state
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string; parentId: string | null }>>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string; color: string | null } | null>(null);
  const [totalDocuments, setTotalDocuments] = useState(0);

  // Sort state
  type SortField = 'name' | 'created_at' | 'size_bytes' | 'file_type';
  type SortDir = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const PAGE_SIZE = 50;
  const [pageOffset, setPageOffset] = useState(0);

  // Fetch folder tree
  const fetchFolderTree = useCallback(async () => {
    try {
      const response = await fetch('/api/documents/folders');
      const data = await response.json();
      if (data.success) {
        setFolderTree(data.tree);
      }
    } catch (error) {
      logger.error('Failed to fetch folder tree', { error });
    }
  }, []);

  // Fetch documents for current folder
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      if (currentFolderId) {
        // Fetch folder contents
        const response = await fetch(`/api/documents/folders/${currentFolderId}`);
        const data = await response.json();
        if (data.success) {
          setDocuments(data.documents);
          setBreadcrumb(data.breadcrumb);
          setTotalDocuments(data.totalDocuments);
        }
      } else {
        // Fetch all documents (no folder filter)
        const params = new URLSearchParams();
        if (scopeFilter === 'archived') {
          params.set('status', 'archived');
        } else if (scopeFilter !== 'all') {
          params.set('scope', scopeFilter);
        }
        if (threadId) {
          params.set('threadId', threadId);
        }
        params.set('orderBy', sortField);
        params.set('orderDirection', sortDir);
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(pageOffset));

        const response = await fetch(`/api/documents?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          if (pageOffset > 0) {
            // Append for "Load More"
            setDocuments((prev) => [...prev, ...data.documents]);
          } else {
            setDocuments(data.documents);
          }
          setTotalDocuments(data.total);
        }
        setBreadcrumb([]);
      }
    } catch (error) {
      logger.error('Failed to fetch documents', { error });
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, scopeFilter, threadId, sortField, sortDir, pageOffset]);

  useEffect(() => {
    fetchFolderTree();
  }, [fetchFolderTree]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Supabase Realtime: auto-update document status
  useEffect(() => {
    let channel: { unsubscribe: () => void } | null = null;

    async function setupRealtime() {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        channel = supabase
          .channel('documents-status')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'documents',
              filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
              const updated = payload.new as Record<string, unknown>;
              setDocuments((prev) =>
                prev.map((doc) =>
                  doc.id === updated.id
                    ? {
                        ...doc,
                        status: updated.status as Document['status'],
                        chunkCount: (updated.chunk_count as number) ?? doc.chunkCount,
                        tokenCount: (updated.token_count as number) ?? doc.tokenCount,
                        processedAt: (updated.processed_at as string) ?? doc.processedAt,
                        processingError: updated.processing_error as string | undefined,
                        metadata: (updated.metadata as Record<string, unknown>) ?? doc.metadata,
                      }
                    : doc
                )
              );
              setSelectedDoc((prev) =>
                prev && prev.id === updated.id
                  ? {
                      ...prev,
                      status: updated.status as Document['status'],
                      chunkCount: (updated.chunk_count as number) ?? prev.chunkCount,
                      tokenCount: (updated.token_count as number) ?? prev.tokenCount,
                      processedAt: (updated.processed_at as string) ?? prev.processedAt,
                      processingError: updated.processing_error as string | undefined,
                      metadata: (updated.metadata as Record<string, unknown>) ?? prev.metadata,
                    }
                  : prev
              );
            }
          )
          .subscribe();
      } catch (error) {
        logger.error('Failed to setup realtime', { error });
      }
    }

    setupRealtime();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  // Debounced semantic search for queries >= 3 chars
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults(null);
      setSearchMode('name');
      return;
    }

    setSearchMode('ai');
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch('/api/documents/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            limit: 20,
            minSimilarity: 0.5,
            scope: scopeFilter !== 'all' ? scopeFilter : undefined,
            folderId: currentFolderId || undefined,
          }),
        });
        const data = await response.json();
        if (data.success && data.results) {
          setSearchResults(data.results);
        }
      } catch (error) {
        logger.error('Semantic search failed', { error });
        setSearchResults(null);
        setSearchMode('name');
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, scopeFilter, currentFolderId]);

  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;

    // If we have semantic search results, use them to filter and rank
    if (searchResults && searchMode === 'ai') {
      const docIds = new Set(searchResults.map((r) => r.documentId));
      const similarityMap = new Map<string, number>();
      for (const r of searchResults) {
        const existing = similarityMap.get(r.documentId) || 0;
        similarityMap.set(r.documentId, Math.max(existing, r.similarity));
      }
      return documents
        .filter((d) => docIds.has(d.id))
        .sort((a, b) => (similarityMap.get(b.id) || 0) - (similarityMap.get(a.id) || 0));
    }

    // Fallback: client-side name filtering
    const query = searchQuery.toLowerCase();
    return documents.filter(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        d.originalName.toLowerCase().includes(query)
    );
  }, [documents, searchQuery, searchResults, searchMode]);

  const handleUploadComplete = useCallback((doc: Document) => {
    setDocuments((prev) => [doc, ...prev]);
    fetchFolderTree();
  }, [fetchFolderTree]);

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeleting(docId);
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        if (selectedDoc?.id === docId) {
          setSelectedDoc(null);
        }
        fetchFolderTree();
      }
    } catch (error) {
      logger.error('Failed to delete document', { error });
    } finally {
      setDeleting(null);
    }
  };

  const handleSelectDoc = useCallback((doc: Document) => {
    setSelectedDoc(doc);
    setDetailTab('details');
    setDocChunks([]);
    setSignedUrl(null);
    setShowMobileDetail(true);
  }, []);

  const fetchDocChunks = useCallback(async (docId: string) => {
    setChunksLoading(true);
    try {
      const response = await fetch(`/api/documents/${docId}`);
      const data = await response.json();
      if (data.success && data.document?.chunks) {
        setDocChunks(data.document.chunks);
      }
    } catch (error) {
      logger.error('Failed to fetch chunks', { error });
    } finally {
      setChunksLoading(false);
    }
  }, []);

  const handleDownload = useCallback(async (docId: string) => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/documents/${docId}/download`);
      const data = await response.json();
      if (data.success && data.signedUrl) {
        setSignedUrl(data.signedUrl);
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      logger.error('Failed to download', { error });
    } finally {
      setDownloading(false);
    }
  }, []);

  // Version history
  const fetchVersions = useCallback(async (docId: string) => {
    setVersionsLoading(true);
    try {
      const response = await fetch(`/api/documents/${docId}/versions`);
      const data = await response.json();
      if (data.success) {
        setVersions(data.versions);
      }
    } catch (error) {
      logger.error('Failed to fetch versions', { error });
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const handleTabChange = useCallback((tab: 'details' | 'preview' | 'chunks' | 'versions') => {
    setDetailTab(tab);
    if ((tab === 'preview' || tab === 'chunks') && selectedDoc && docChunks.length === 0) {
      fetchDocChunks(selectedDoc.id);
    }
    if (tab === 'preview' && selectedDoc && !signedUrl) {
      if (['image', 'pdf'].includes(selectedDoc.fileType)) {
        fetch(`/api/documents/${selectedDoc.id}/download?mode=preview`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.signedUrl) {
              setSignedUrl(data.signedUrl);
            }
          })
          .catch(() => {});
      }
    }
    if (tab === 'versions' && selectedDoc) {
      fetchVersions(selectedDoc.id);
    }
  }, [selectedDoc, docChunks.length, signedUrl, fetchDocChunks, fetchVersions]);

  // Folder navigation
  const handleSelectFolder = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedDoc(null);
  }, []);

  // Folder CRUD
  const handleCreateFolder = useCallback((parentId: string | null) => {
    setCreateFolderParentId(parentId);
    setShowCreateFolder(true);
  }, []);

  const handleCreateFolderSubmit = useCallback(async (name: string, color: string | null) => {
    const response = await fetch('/api/documents/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        parentId: createFolderParentId,
        color,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create folder');
    }

    await fetchFolderTree();
    if (currentFolderId === createFolderParentId) {
      await fetchDocuments();
    }
  }, [createFolderParentId, currentFolderId, fetchFolderTree, fetchDocuments]);

  const handleRenameFolder = useCallback((folderId: string, currentName: string, currentColor: string | null) => {
    setRenamingFolder({ id: folderId, name: currentName, color: currentColor });
  }, []);

  const handleRenameFolderSubmit = useCallback(async (name: string, _color: string | null) => {
    if (!renamingFolder) return;

    const response = await fetch(`/api/documents/folders/${renamingFolder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to rename folder');
    }

    await fetchFolderTree();
    if (currentFolderId === renamingFolder.id) {
      await fetchDocuments();
    }
  }, [renamingFolder, currentFolderId, fetchFolderTree, fetchDocuments]);

  const handleDeleteFolder = useCallback(async (folderId: string, name: string) => {
    if (!confirm(`Delete folder "${name}" and all subfolders? Documents will be moved to root.`)) return;

    try {
      const response = await fetch(`/api/documents/folders/${folderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (currentFolderId === folderId) {
          setCurrentFolderId(null);
        }
        await fetchFolderTree();
        await fetchDocuments();
      }
    } catch (error) {
      logger.error('Failed to delete folder', { error });
    }
  }, [currentFolderId, fetchFolderTree, fetchDocuments]);

  // Drag and drop document to folder
  const handleDropDocument = useCallback(async (documentId: string, folderId: string | null) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });

      if (response.ok) {
        await fetchDocuments();
        await fetchFolderTree();
      }
    } catch (error) {
      logger.error('Failed to move document', { error });
    }
  }, [fetchDocuments, fetchFolderTree]);

  const handleDragStart = useCallback((e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData('application/x-document-id', docId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // Bulk selection handlers
  const handleBulkSelect = useCallback((docId: string, index: number, shiftKey: boolean) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIndex !== null) {
        // Range select
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          const doc = filteredDocuments[i];
          if (doc) next.add(doc.id);
        }
      } else {
        if (next.has(docId)) {
          next.delete(docId);
        } else {
          next.add(docId);
        }
      }
      return next;
    });
    setLastSelectedIndex(index);
  }, [lastSelectedIndex, filteredDocuments]);

  const handleSelectAll = useCallback(() => {
    if (selectedDocIds.size === filteredDocuments.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocuments.map((d) => d.id)));
    }
  }, [filteredDocuments, selectedDocIds.size]);

  const handleBulkDelete = useCallback(async () => {
    if (!confirm(`Delete ${selectedDocIds.size} documents?`)) return;
    setBulkActing(true);
    try {
      const response = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', documentIds: Array.from(selectedDocIds) }),
      });
      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => !selectedDocIds.has(d.id)));
        setSelectedDocIds(new Set());
        if (selectedDoc && selectedDocIds.has(selectedDoc.id)) setSelectedDoc(null);
        fetchFolderTree();
      }
    } catch (error) {
      logger.error('Bulk delete failed', { error });
    } finally {
      setBulkActing(false);
    }
  }, [selectedDocIds, selectedDoc, fetchFolderTree]);

  const handleBulkMove = useCallback(async (folderId: string | null) => {
    setBulkActing(true);
    try {
      const response = await fetch('/api/documents/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', documentIds: Array.from(selectedDocIds), params: { folderId } }),
      });
      if (response.ok) {
        setSelectedDocIds(new Set());
        fetchDocuments();
        fetchFolderTree();
      }
    } catch (error) {
      logger.error('Bulk move failed', { error });
    } finally {
      setBulkActing(false);
    }
  }, [selectedDocIds, fetchDocuments, fetchFolderTree]);

  // Archive / Restore handlers
  const handleArchive = useCallback(async (docId: string) => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/documents/${docId}/archive`, { method: 'POST' });
      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        if (selectedDoc?.id === docId) setSelectedDoc(null);
      }
    } catch (error) {
      logger.error('Failed to archive', { error });
    } finally {
      setArchiving(false);
    }
  }, [selectedDoc]);

  const handleRestore = useCallback(async (docId: string) => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/documents/${docId}/archive`, { method: 'DELETE' });
      if (response.ok) {
        // Remove from archived view
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        if (selectedDoc?.id === docId) setSelectedDoc(null);
      }
    } catch (error) {
      logger.error('Failed to restore', { error });
    } finally {
      setArchiving(false);
    }
  }, [selectedDoc]);

  // Upload new version
  const handleUploadNewVersion = useCallback(async (docId: string) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`/api/documents/${docId}/versions`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (data.success) {
          fetchDocuments();
          if (selectedDoc?.id === docId) {
            fetchVersions(docId);
          }
        }
      } catch (error) {
        logger.error('Failed to upload new version', { error });
      }
    };
    input.click();
  }, [selectedDoc, fetchDocuments, fetchVersions]);

  // filteredDocuments is defined earlier via useMemo (see above)

  const StatusIcon = ({ status }: { status: Document['status'] }) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  if (compact) {
    return (
      <div className="space-y-4">
        <FileUploadZone
          scope={threadId ? 'conversation' : 'global'}
          threadId={threadId}
          onUploadComplete={handleUploadComplete}
          compact
        />

        <div className="space-y-2">
          {filteredDocuments.slice(0, 5).map((doc) => {
            const Icon = FILE_TYPE_ICONS[doc.fileType] || File;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                onClick={() => handleSelectDoc(doc)}
              >
                <Icon className={`w-4 h-4 ${FILE_TYPE_COLORS[doc.fileType]}`} />
                <span className="text-sm text-white/80 truncate flex-1">
                  {doc.name}
                </span>
                <StatusIcon status={doc.status} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            {/* Mobile folder toggle */}
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle folder sidebar"
            >
              {showMobileSidebar ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Knowledge Base</h1>
          </div>
          <button
            onClick={() => { fetchDocuments(); fetchFolderTree(); }}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Refresh documents"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-10 pr-20 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30"
            />
            {searchQuery.length > 0 && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full ${
                searchMode === 'ai'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-white/10 text-white/50'
              }`}>
                {searching ? '...' : searchMode === 'ai' ? 'AI Search' : 'Name'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={`${sortField}:${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split(':') as [SortField, SortDir];
                setSortField(field);
                setSortDir(dir);
                setPageOffset(0);
              }}
              className="flex-1 sm:flex-none px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
              aria-label="Sort documents"
            >
              <option value="created_at:desc">Newest</option>
              <option value="created_at:asc">Oldest</option>
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="size_bytes:desc">Largest</option>
              <option value="size_bytes:asc">Smallest</option>
              <option value="file_type:asc">Type</option>
            </select>
            <select
              value={scopeFilter}
              onChange={(e) => { setScopeFilter(e.target.value as DocumentScope | 'all' | 'archived'); setPageOffset(0); }}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
              aria-label="Filter by scope"
            >
              <option value="all">All</option>
              <option value="global">Global</option>
              <option value="conversation">Conversation</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content: 3-panel layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Folder tree sidebar - desktop: static, mobile: overlay */}
        {/* Mobile overlay backdrop */}
        {showMobileSidebar && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-20"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}
        <div className={`
          ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          fixed md:static inset-y-0 left-0 z-30 md:z-auto
          w-[260px] md:w-[220px] border-r border-white/10 overflow-y-auto p-2 shrink-0
          bg-black/95 md:bg-transparent backdrop-blur-lg md:backdrop-blur-none
          transition-transform duration-200 ease-in-out
        `}>
          <div className="flex items-center justify-between mb-2 md:hidden">
            <span className="text-sm font-medium text-white/70 pl-2">Folders</span>
            <button
              onClick={() => setShowMobileSidebar(false)}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <FolderTree
            tree={folderTree}
            selectedFolderId={currentFolderId}
            onSelectFolder={(id) => { handleSelectFolder(id); setShowMobileSidebar(false); }}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDropDocument={handleDropDocument}
            rootDocumentCount={totalDocuments}
          />
        </div>

        {/* Document list */}
        <div className="flex-1 min-w-0 md:border-r border-white/10 overflow-y-auto p-3 md:p-4">
          {/* Breadcrumb */}
          {breadcrumb.length > 0 && (
            <div className="mb-4">
              <FolderBreadcrumb
                breadcrumb={breadcrumb}
                onNavigate={handleSelectFolder}
              />
            </div>
          )}

          {/* Storage stats */}
          <StorageStats />

          {/* Upload zone */}
          <div className="mb-6">
            <FileUploadZone
              scope={threadId ? 'conversation' : 'global'}
              threadId={threadId}
              folderId={currentFolderId}
              onUploadComplete={handleUploadComplete}
            />
          </div>

          {/* Bulk action bar */}
          {selectedDocIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
              <button
                onClick={handleSelectAll}
                className="text-sm text-white/60 hover:text-white"
              >
                {selectedDocIds.size === filteredDocuments.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-white/50">
                {selectedDocIds.size} selected
              </span>
              <div className="flex-1" />
              <button
                onClick={() => handleBulkMove(null)}
                disabled={bulkActing}
                className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded-lg text-white/80 transition-colors disabled:opacity-50"
              >
                Move to Root
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkActing}
                className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors disabled:opacity-50"
              >
                {bulkActing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          )}

          {/* Documents */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <p className="text-white/50">No documents found</p>
              <p className="text-white/30 text-sm mt-1">
                Upload files to build your knowledge base
              </p>
            </div>
          ) : (
            <>
            <div className="space-y-2">
              {filteredDocuments.map((doc) => {
                const Icon = FILE_TYPE_ICONS[doc.fileType] || File;
                const isSelected = selectedDoc?.id === doc.id;

                return (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, doc.id)}
                    onClick={() => handleSelectDoc(doc)}
                    className={`
                      group p-4 rounded-xl cursor-pointer transition-all
                      ${isSelected
                        ? 'bg-white/10 border border-white/20'
                        : 'hover:bg-white/5 border border-transparent'
                      }
                      ${selectedDocIds.has(doc.id) ? 'bg-blue-500/10 border-blue-400/20' : ''}
                      ${doc.status === 'archived' ? 'opacity-50' : ''}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={selectedDocIds.has(doc.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleBulkSelect(doc.id, filteredDocuments.indexOf(doc), e.nativeEvent instanceof MouseEvent ? (e.nativeEvent as MouseEvent).shiftKey : false);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-4 h-4 rounded border border-white/20 bg-white/5 cursor-pointer accent-blue-500 ${
                            selectedDocIds.size > 0 ? 'visible' : 'invisible group-hover:visible'
                          }`}
                          aria-label={`Select ${doc.name}`}
                        />
                        <div className="text-white/20 cursor-grab" aria-label="Drag to move">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      </div>
                      <div className={`p-2 rounded-lg bg-white/5 ${FILE_TYPE_COLORS[doc.fileType]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white truncate">
                            {doc.name}
                          </h3>
                          {doc.version > 1 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                              v{doc.version}
                            </span>
                          )}
                          <StatusIcon status={doc.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
                          <span>{formatBytes(doc.sizeBytes)}</span>
                          <span>•</span>
                          <span>{formatDate(doc.createdAt)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {doc.scope === 'global' ? (
                              <>
                                <Globe className="w-3 h-3" />
                                Global
                              </>
                            ) : (
                              <>
                                <MessageSquare className="w-3 h-3" />
                                Conversation
                              </>
                            )}
                          </span>
                          {doc.status === 'processing' && !!doc.metadata?.processing_progress && (
                            <>
                              <span>•</span>
                              <span className="text-blue-400">{String(doc.metadata.processing_progress)}</span>
                            </>
                          )}
                          {doc.status === 'archived' && (
                            <>
                              <span>•</span>
                              <span className="text-yellow-400/70">Archived</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm text-white/50">
              <span>{filteredDocuments.length} of {totalDocuments} documents</span>
              {documents.length < totalDocuments && !searchQuery && (
                <button
                  onClick={() => setPageOffset(documents.length)}
                  className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/70"
                >
                  Load More
                </button>
              )}
            </div>
            </>
          )}
        </div>

        {/* Document details - desktop: static panel, mobile: full-screen overlay */}
        {/* Mobile detail backdrop */}
        {showMobileDetail && selectedDoc && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-20"
            onClick={() => setShowMobileDetail(false)}
          />
        )}
        <div className={`
          ${showMobileDetail && selectedDoc ? 'translate-x-0' : 'translate-x-full'}
          md:translate-x-0
          fixed md:static inset-y-0 right-0 z-30 md:z-auto
          w-full sm:w-[85vw] md:w-[400px] shrink-0 overflow-y-auto p-4 md:p-6
          bg-black/95 md:bg-transparent backdrop-blur-lg md:backdrop-blur-none
          transition-transform duration-200 ease-in-out
        `}>
          {/* Mobile close button */}
          <button
            onClick={() => setShowMobileDetail(false)}
            className="md:hidden mb-3 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
          {selectedDoc ? (
            <div>
              {/* Header with actions */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    {selectedDoc.name}
                  </h2>
                  <p className="text-white/50 text-sm">
                    {selectedDoc.originalName}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleUploadNewVersion(selectedDoc.id)}
                    className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Upload new version"
                    title="Upload new version"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(selectedDoc.id)}
                    disabled={downloading}
                    className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    aria-label="Download document"
                  >
                    {downloading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>
                  {selectedDoc.status === 'archived' ? (
                    <button
                      onClick={() => handleRestore(selectedDoc.id)}
                      disabled={archiving}
                      className="p-2 rounded-lg text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50"
                      aria-label="Restore from archive"
                      title="Restore"
                    >
                      {archiving ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleArchive(selectedDoc.id)}
                      disabled={archiving}
                      className="p-2 rounded-lg text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
                      aria-label="Archive document"
                      title="Archive"
                    >
                      {archiving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Archive className="w-5 h-5" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(selectedDoc.id)}
                    disabled={deleting === selectedDoc.id}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    aria-label="Delete document"
                  >
                    {deleting === selectedDoc.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="mb-4">
                <div className={`
                  inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                  ${selectedDoc.status === 'ready' ? 'bg-green-400/10 text-green-400' : ''}
                  ${selectedDoc.status === 'processing' ? 'bg-blue-400/10 text-blue-400' : ''}
                  ${selectedDoc.status === 'error' ? 'bg-red-400/10 text-red-400' : ''}
                  ${selectedDoc.status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' : ''}
                `}>
                  <StatusIcon status={selectedDoc.status} />
                  <span className="capitalize">
                    {selectedDoc.status === 'processing' && selectedDoc.metadata?.processing_progress
                      ? `Embedding ${selectedDoc.metadata.processing_progress}`
                      : selectedDoc.status}
                  </span>
                </div>
                {selectedDoc.processingError && (
                  <p className="mt-2 text-sm text-red-400">
                    {selectedDoc.processingError}
                  </p>
                )}
                {selectedDoc.status === 'error' && (
                  <button
                    onClick={async () => {
                      setReprocessing(true);
                      try {
                        const response = await fetch(`/api/documents/${selectedDoc.id}/reprocess`, {
                          method: 'POST',
                        });
                        if (response.ok) {
                          setSelectedDoc({ ...selectedDoc, status: 'pending', processingError: undefined });
                          setDocuments((prev) =>
                            prev.map((d) =>
                              d.id === selectedDoc.id
                                ? { ...d, status: 'pending' as const, processingError: undefined }
                                : d
                            )
                          );
                        }
                      } catch (error) {
                        logger.error('Failed to reprocess', { error });
                      } finally {
                        setReprocessing(false);
                      }
                    }}
                    disabled={reprocessing}
                    className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {reprocessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Retry Processing
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4 border-b border-white/10">
                {(['details', 'preview', 'chunks', 'versions'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`
                      px-4 py-2 text-sm font-medium transition-colors capitalize
                      ${detailTab === tab
                        ? 'text-white border-b-2 border-white'
                        : 'text-white/50 hover:text-white/80'
                      }
                    `}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {detailTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-white/50 text-sm mb-1">File Type</p>
                      <p className="text-white font-medium uppercase">
                        {selectedDoc.fileType}
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-white/50 text-sm mb-1">Size</p>
                      <p className="text-white font-medium">
                        {formatBytes(selectedDoc.sizeBytes)}
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-white/50 text-sm mb-1">Chunks</p>
                      <p className="text-white font-medium">
                        {selectedDoc.chunkCount || 0}
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-white/50 text-sm mb-1">Tokens</p>
                      <p className="text-white font-medium">
                        {(selectedDoc.tokenCount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-white/50 text-sm mb-1">Scope</p>
                    <div className="flex items-center gap-2 text-white">
                      {selectedDoc.scope === 'global' ? (
                        <>
                          <Globe className="w-4 h-4" />
                          <span>Available to all conversations</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          <span>Conversation-specific</span>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedDoc.metadata && Object.keys(selectedDoc.metadata).length > 0 && (
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-white/50 text-sm mb-2">Metadata</p>
                      <pre className="text-sm text-white/80 overflow-x-auto">
                        {JSON.stringify(selectedDoc.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-white/50 text-sm mb-1">Uploaded</p>
                    <p className="text-white">
                      {new Date(selectedDoc.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {selectedDoc.processedAt && (
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-white/50 text-sm mb-1">Processed</p>
                      <p className="text-white">
                        {new Date(selectedDoc.processedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'preview' && (
                <DocumentPreview
                  document={selectedDoc}
                  chunks={docChunks.length > 0 ? docChunks : undefined}
                  signedUrl={signedUrl || undefined}
                />
              )}

              {detailTab === 'chunks' && (
                <div className="space-y-2">
                  {chunksLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                    </div>
                  ) : docChunks.length === 0 ? (
                    <p className="text-white/50 text-sm text-center py-8">
                      No chunks available
                    </p>
                  ) : (
                    docChunks.map((chunk, index) => (
                      <div
                        key={chunk.id}
                        className="p-3 bg-white/5 rounded-lg border border-white/5"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-white/40 font-mono">
                            #{index}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                            {chunk.chunkType}
                          </span>
                          {chunk.tokenCount && (
                            <span className="text-xs text-white/40">
                              {chunk.tokenCount} tokens
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/70 whitespace-pre-wrap line-clamp-4">
                          {chunk.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailTab === 'versions' && (
                <div className="space-y-2">
                  {versionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="w-8 h-8 mx-auto mb-2 text-white/20" />
                      <p className="text-white/50 text-sm">No version history</p>
                      <p className="text-white/30 text-xs mt-1">Upload a new version to start tracking</p>
                    </div>
                  ) : (
                    versions.map((ver) => (
                      <div
                        key={ver.id}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          ver.id === selectedDoc.id
                            ? 'bg-white/10 border-white/20'
                            : 'bg-white/5 border-white/5 hover:bg-white/[0.07]'
                        }`}
                        onClick={() => {
                          if (ver.id !== selectedDoc.id) {
                            // Switch to this version
                            const versionDoc = documents.find((d) => d.id === ver.id);
                            if (versionDoc) handleSelectDoc(versionDoc);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white">
                            v{ver.version}
                            {ver.isLatest && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-green-400/10 text-green-400">
                                Latest
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-white/40">
                            {formatBytes(ver.sizeBytes)}
                          </span>
                        </div>
                        <div className="text-xs text-white/50">
                          {new Date(ver.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => handleUploadNewVersion(selectedDoc.id)}
                    className="w-full mt-2 py-2 px-3 rounded-lg border border-dashed border-white/20 text-sm text-white/50 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload New Version
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-white/20" />
                <p className="text-white/50">Select a document to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create folder dialog */}
      <CreateFolderDialog
        open={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onSubmit={handleCreateFolderSubmit}
        mode="create"
      />

      {/* Rename folder dialog */}
      <CreateFolderDialog
        open={renamingFolder !== null}
        onClose={() => setRenamingFolder(null)}
        onSubmit={handleRenameFolderSubmit}
        initialName={renamingFolder?.name || ''}
        initialColor={renamingFolder?.color || null}
        mode="rename"
      />
    </div>
  );
}

export default KnowledgeBase;
