'use client';

/**
 * FolderTree
 * Recursive collapsible tree sidebar for folder navigation
 */

import React, { useState, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  FileText,
} from 'lucide-react';
import { ContextMenu, useContextMenu } from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';
import type { FolderTreeNode } from '@/lib/documents/types';

interface FolderTreeProps {
  tree: FolderTreeNode[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string, currentName: string, currentColor: string | null) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
  onDropDocument?: (documentId: string, folderId: string | null) => void;
  rootDocumentCount?: number;
}

interface TreeNodeProps {
  node: FolderTreeNode;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string, currentName: string, currentColor: string | null) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
  onDropDocument?: (documentId: string, folderId: string | null) => void;
  depth: number;
}

function TreeNode({
  node,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropDocument,
  depth,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [dragOver, setDragOver] = useState(false);
  const { menuPos, handleContextMenu, closeMenu } = useContextMenu();
  const isSelected = selectedFolderId === node.id;
  const hasChildren = node.children.length > 0;

  const handleClick = useCallback(() => {
    onSelectFolder(node.id);
  }, [node.id, onSelectFolder]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelectFolder(node.id);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (hasChildren && !expanded) setExpanded(true);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (expanded) setExpanded(false);
        break;
    }
  }, [node.id, hasChildren, expanded, onSelectFolder]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const docId = e.dataTransfer.types.includes('application/x-document-id');
    if (docId) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const documentId = e.dataTransfer.getData('application/x-document-id');
    if (documentId && onDropDocument) {
      onDropDocument(documentId, node.id);
    }
  }, [node.id, onDropDocument]);

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'New subfolder',
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: () => onCreateFolder(node.id),
    },
    {
      label: 'Rename',
      icon: <Pencil className="w-3.5 h-3.5" />,
      onClick: () => onRenameFolder(node.id, node.name, node.color),
    },
    {
      label: 'Delete',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: () => onDeleteFolder(node.id, node.name),
      variant: 'danger',
    },
  ];

  const FolderIcon = isSelected || expanded ? FolderOpen : Folder;

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-sm outline-none focus-visible:ring-1 focus-visible:ring-white/30
          ${isSelected ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}
          ${dragOver ? 'bg-blue-500/20 border border-blue-400/40' : 'border border-transparent'}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={handleToggle}
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          className={`p-0.5 rounded hover:bg-white/10 transition-colors ${
            hasChildren ? 'visible' : 'invisible'
          }`}
          tabIndex={-1}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Folder icon */}
        <FolderIcon
          className="w-4 h-4 shrink-0"
          style={{ color: node.color || undefined }}
        />

        {/* Name */}
        <span className="truncate flex-1">{node.name}</span>

        {/* Document count */}
        {node.documentCount > 0 && (
          <span className="text-xs text-white/40 tabular-nums">
            {node.documentCount}
          </span>
        )}

        {/* Hover actions */}
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(node.id);
            }}
            className="p-0.5 rounded hover:bg-white/10"
            aria-label="New subfolder"
            tabIndex={-1}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Portal-based context menu */}
      <ContextMenu
        items={contextMenuItems}
        position={menuPos}
        onClose={closeMenu}
      />

      {/* Children */}
      {expanded && hasChildren && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onDropDocument={onDropDocument}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({
  tree,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropDocument,
  rootDocumentCount = 0,
}: FolderTreeProps) {
  const [rootDragOver, setRootDragOver] = useState(false);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/x-document-id')) {
      setRootDragOver(true);
    }
  }, []);

  const handleRootDragLeave = useCallback(() => {
    setRootDragOver(false);
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setRootDragOver(false);
    const documentId = e.dataTransfer.getData('application/x-document-id');
    if (documentId && onDropDocument) {
      onDropDocument(documentId, null);
    }
  }, [onDropDocument]);

  return (
    <div className="py-2 space-y-0.5" role="tree" aria-label="Folder navigation">
      {/* All Documents (root) */}
      <div
        onClick={() => onSelectFolder(null)}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        className={`
          group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-sm
          ${selectedFolderId === null ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}
          ${rootDragOver ? 'bg-blue-500/20 border border-blue-400/40' : 'border border-transparent'}
        `}
        style={{ paddingLeft: '8px' }}
      >
        <div className="p-0.5 invisible">
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1 font-medium">All Documents</span>
        {rootDocumentCount > 0 && (
          <span className="text-xs text-white/40 tabular-nums">
            {rootDocumentCount}
          </span>
        )}
      </div>

      {/* Folder tree */}
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onDropDocument={onDropDocument}
          depth={0}
        />
      ))}

      {/* New folder button */}
      <button
        onClick={() => onCreateFolder(null)}
        className="flex items-center gap-1.5 px-2 py-1.5 mt-2 w-full rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        style={{ paddingLeft: '8px' }}
      >
        <div className="p-0.5 invisible">
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
        <Plus className="w-4 h-4" />
        <span>New Folder</span>
      </button>
    </div>
  );
}

export default FolderTree;
