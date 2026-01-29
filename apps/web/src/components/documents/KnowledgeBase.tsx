'use client';

/**
 * KnowledgeBase
 * Full-page document management interface with folder navigation
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { FileUploadZone } from './FileUploadZone';
import { DocumentPreview } from './DocumentPreview';
import { FolderTree } from './FolderTree';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { CreateFolderDialog } from './CreateFolderDialog';
import type {
  Document,
  DocumentChunk,
  DocumentScope,
  FileType,
  FolderTreeNode,
} from '@/lib/documents/types';

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
  const [scopeFilter, setScopeFilter] = useState<DocumentScope | 'all'>(initialScope || 'all');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'preview' | 'chunks'>('details');
  const [docChunks, setDocChunks] = useState<DocumentChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Folder state
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Array<{ id: string; name: string; parentId: string | null }>>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string; color: string | null } | null>(null);
  const [totalDocuments, setTotalDocuments] = useState(0);

  // Fetch folder tree
  const fetchFolderTree = useCallback(async () => {
    try {
      const response = await fetch('/api/documents/folders');
      const data = await response.json();
      if (data.success) {
        setFolderTree(data.tree);
      }
    } catch (error) {
      console.error('Failed to fetch folder tree:', error);
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
        if (scopeFilter !== 'all') {
          params.set('scope', scopeFilter);
        }
        if (threadId) {
          params.set('threadId', threadId);
        }

        const response = await fetch(`/api/documents?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          setDocuments(data.documents);
          setTotalDocuments(data.total);
        }
        setBreadcrumb([]);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, scopeFilter, threadId]);

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
        console.error('Failed to setup realtime:', error);
      }
    }

    setupRealtime();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

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
      console.error('Failed to delete document:', error);
    } finally {
      setDeleting(null);
    }
  };

  const handleSelectDoc = useCallback((doc: Document) => {
    setSelectedDoc(doc);
    setDetailTab('details');
    setDocChunks([]);
    setSignedUrl(null);
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
      console.error('Failed to fetch chunks:', error);
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
      console.error('Failed to download:', error);
    } finally {
      setDownloading(false);
    }
  }, []);

  const handleTabChange = useCallback((tab: 'details' | 'preview' | 'chunks') => {
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
  }, [selectedDoc, docChunks.length, signedUrl, fetchDocChunks]);

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
      console.error('Failed to delete folder:', error);
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
      console.error('Failed to move document:', error);
    }
  }, [fetchDocuments, fetchFolderTree]);

  const handleDragStart = useCallback((e: React.DragEvent, docId: string) => {
    e.dataTransfer.setData('application/x-document-id', docId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.name.toLowerCase().includes(query) ||
      doc.originalName.toLowerCase().includes(query)
    );
  });

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
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
          <button
            onClick={() => { fetchDocuments(); fetchFolderTree(); }}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30"
            />
          </div>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as DocumentScope | 'all')}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
          >
            <option value="all">All Documents</option>
            <option value="global">Global</option>
            <option value="conversation">Conversation</option>
          </select>
        </div>
      </div>

      {/* Content: 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Folder tree sidebar */}
        <div className="w-[220px] border-r border-white/10 overflow-y-auto p-2 shrink-0">
          <FolderTree
            tree={folderTree}
            selectedFolderId={currentFolderId}
            onSelectFolder={handleSelectFolder}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDropDocument={handleDropDocument}
            rootDocumentCount={totalDocuments}
          />
        </div>

        {/* Document list */}
        <div className="flex-1 min-w-0 border-r border-white/10 overflow-y-auto p-4">
          {/* Breadcrumb */}
          {breadcrumb.length > 0 && (
            <div className="mb-4">
              <FolderBreadcrumb
                breadcrumb={breadcrumb}
                onNavigate={handleSelectFolder}
              />
            </div>
          )}

          {/* Upload zone */}
          <div className="mb-6">
            <FileUploadZone
              scope={threadId ? 'conversation' : 'global'}
              threadId={threadId}
              folderId={currentFolderId}
              onUploadComplete={handleUploadComplete}
            />
          </div>

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
                      p-4 rounded-xl cursor-pointer transition-all
                      ${isSelected
                        ? 'bg-white/10 border border-white/20'
                        : 'hover:bg-white/5 border border-transparent'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-white/20 cursor-grab">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className={`p-2 rounded-lg bg-white/5 ${FILE_TYPE_COLORS[doc.fileType]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white truncate">
                            {doc.name}
                          </h3>
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
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Document details */}
        <div className="w-[400px] shrink-0 overflow-y-auto p-6">
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(selectedDoc.id)}
                    disabled={downloading}
                    className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    title="Download"
                  >
                    {downloading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedDoc.id)}
                    disabled={deleting === selectedDoc.id}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                    title="Delete document"
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
                  <span className="capitalize">{selectedDoc.status}</span>
                </div>
                {selectedDoc.processingError && (
                  <p className="mt-2 text-sm text-red-400">
                    {selectedDoc.processingError}
                  </p>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4 border-b border-white/10">
                {(['details', 'preview', 'chunks'] as const).map((tab) => (
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
