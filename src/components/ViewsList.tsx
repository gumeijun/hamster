/**
 * Views List Component
 * 
 * Displays and manages database views.
 * Features:
 * - List all views in a database
 * - Create new view with SQL editor
 * - Delete selected views (supports multi-select)
 * - View definition modal to inspect view SQL
 * - Refresh functionality
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Eye, Code } from 'lucide-react';

interface ViewsListProps {
  connectionId: string;
  database: string;
}

interface ViewDefinition {
  name: string;
  definition: string;
  characterSetClient: string;
  collationConnection: string;
}

export function ViewsList({ connectionId, database }: ViewsListProps) {
  const [views, setViews] = useState<string[]>([]);
  const [selectedViews, setSelectedViews] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create View Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewSelect, setNewViewSelect] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  
  // View Definition Modal State
  const [viewDefinition, setViewDefinition] = useState<ViewDefinition | null>(null);
  const [isDefinitionModalOpen, setIsDefinitionModalOpen] = useState(false);

  const loadViews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.ipcRenderer.invoke('db:list-views', connectionId, database);
      if (res.success) {
        setViews(res.results);
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadViews();
  }, [connectionId, database]);

  const handleSelectView = (viewName: string, e: React.MouseEvent) => {
    const newSelected = new Set(selectedViews);
    if (e.ctrlKey || e.metaKey) {
      // Multi-select
      if (newSelected.has(viewName)) {
        newSelected.delete(viewName);
      } else {
        newSelected.add(viewName);
      }
    } else {
      // Single select
      newSelected.clear();
      newSelected.add(viewName);
    }
    setSelectedViews(newSelected);
  };

  const handleDeleteViews = async () => {
    if (selectedViews.size === 0) {
      alert('Please select views to delete first');
      return;
    }

    const viewNames = Array.from(selectedViews);
    if (!window.confirm(`Are you sure you want to delete ${viewNames.length} view(s)?\n${viewNames.join(', ')}`)) {
      return;
    }

    for (const viewName of viewNames) {
      try {
        const res = await window.ipcRenderer.invoke('db:drop-view', connectionId, database, viewName);
        if (!res.success) {
          alert(`Failed to delete view ${viewName}: ${res.error}`);
        }
      } catch (err: any) {
        alert(`Error deleting view ${viewName}: ${err.message}`);
      }
    }

    setSelectedViews(new Set());
    loadViews();
  };

  const handleCreateView = async () => {
    if (!newViewName.trim()) {
      setCreateError('Please enter view name');
      return;
    }
    if (!newViewSelect.trim()) {
      setCreateError('Please enter SELECT statement');
      return;
    }

    try {
      const res = await window.ipcRenderer.invoke('db:create-view', connectionId, database, newViewName.trim(), newViewSelect.trim());
      if (res.success) {
        setIsCreateModalOpen(false);
        setNewViewName('');
        setNewViewSelect('');
        setCreateError(null);
        loadViews();
      } else {
        setCreateError(res.error);
      }
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const handleViewDefinition = async (viewName: string) => {
    try {
      const res = await window.ipcRenderer.invoke('db:get-view-definition', connectionId, database, viewName);
      if (res.success) {
        setViewDefinition(res.results);
        setIsDefinitionModalOpen(true);
      } else {
        alert('Failed to get view definition: ' + res.error);
      }
    } catch (err: any) {
      alert('Error getting view definition: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Plus size={14} />
          Create View
        </button>
        <button
          onClick={handleDeleteViews}
          disabled={selectedViews.size === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
          Delete View
        </button>
        <div className="flex-1" />
        <button
          onClick={loadViews}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Views List */}
      <div className="flex-1 overflow-auto">
        {views.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            No views found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">View Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {views.map((viewName) => (
                <tr
                  key={viewName}
                  className={`border-b cursor-pointer hover:bg-gray-50 ${
                    selectedViews.has(viewName) ? 'bg-blue-50' : ''
                  }`}
                  onClick={(e) => handleSelectView(viewName, e)}
                >
                  <td className="px-4 py-2 flex items-center gap-2">
                    <Eye size={14} className="text-purple-500" />
                    {viewName}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDefinition(viewName);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-gray-600"
                      title="View Definition"
                    >
                      <Code size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create View Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-auto">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Create View</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  View Name
                </label>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter view name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SELECT Statement
                </label>
                <textarea
                  value={newViewSelect}
                  onChange={(e) => setNewViewSelect(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={8}
                  placeholder="SELECT column1, column2 FROM table_name WHERE ..."
                />
              </div>
              {createError && (
                <div className="text-red-500 text-sm">{createError}</div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateError(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateView}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Definition Modal */}
      {isDefinitionModalOpen && viewDefinition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] overflow-auto">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">View Definition: {viewDefinition.name}</h2>
            </div>
            <div className="p-4">
              <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-auto max-h-[400px] font-mono">
                {viewDefinition.definition}
              </pre>
              <div className="mt-4 text-sm text-gray-500">
                <p>Character Set: {viewDefinition.characterSetClient}</p>
                <p>Collation: {viewDefinition.collationConnection}</p>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setIsDefinitionModalOpen(false);
                  setViewDefinition(null);
                }}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
