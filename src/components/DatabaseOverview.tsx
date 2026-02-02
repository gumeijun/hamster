/**
 * Database Overview Component
 * 
 * Displays a comprehensive list of all tables in a database.
 * Features:
 * - Table list with metadata (rows, size, engine, collation, timestamps)
 * - Search/filter functionality for tables
 * - Create new table button
 * - Context menu for table operations (open, edit)
 * - Double-click to open table data viewer
 */

import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Edit, Table, Search, X, Plus } from 'lucide-react';

interface DatabaseOverviewProps {
  connectionId: string;
  database: string;
  onSelectTable: (connectionId: string, database: string, table: string) => void;
  onDesignTable: (connectionId: string, database: string, table: string) => void;
}

interface TableStatus {
  Name: string;
  Rows: number;
  Data_length: number;
  Engine: string;
  Create_time: string;
  Update_time: string;
  Collation: string;
  Comment: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DatabaseOverview({ connectionId, database, onSelectTable, onDesignTable }: DatabaseOverviewProps) {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Filter tables (fuzzy search)
  const filteredTables = tables.filter(table => 
    table.Name.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    table: string;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, table: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      table
    });
  };

  // Handle edit table
  const handleDesignTable = () => {
    if (contextMenu) {
      onDesignTable(connectionId, database, contextMenu.table);
      setContextMenu(null);
    }
  };

  // Handle open table
  const handleOpenTable = () => {
    if (contextMenu) {
      onSelectTable(connectionId, database, contextMenu.table);
      setContextMenu(null);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.ipcRenderer.invoke('db:get-database-status', connectionId, database);
      if (res.success) {
        setTables(res.results);
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
    fetchData();
  }, [connectionId, database]);

  if (loading) return <div className="p-4 text-gray-500">Loading database info...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-10 border-b flex items-center px-4 bg-gray-50 justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-700">Database: {database}</h2>
          <button
            onClick={() => onDesignTable(connectionId, database, '')}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            title="New Table"
          >
            <Plus size={12} />
            New Table
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Search tables..."
              className="pl-7 pr-7 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button onClick={fetchData} className="p-1 hover:bg-gray-200 rounded text-gray-600" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto w-full">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
              <tr>
                <th className="border p-2 text-left whitespace-nowrap bg-gray-100">Name</th>
                <th className="border p-2 text-right whitespace-nowrap bg-gray-100">Rows</th>
                <th className="border p-2 text-right whitespace-nowrap bg-gray-100">Size</th>
                <th className="border p-2 text-left whitespace-nowrap bg-gray-100">Engine</th>
                <th className="border p-2 text-left whitespace-nowrap bg-gray-100">Collation</th>
                <th className="border p-2 text-left whitespace-nowrap bg-gray-100">Created</th>
                <th className="border p-2 text-left whitespace-nowrap bg-gray-100">Updated</th>
                <th className="border p-2 text-left whitespace-nowrap bg-gray-100">Comment</th>
              </tr>
            </thead>
            <tbody>
              {filteredTables.map((table) => (
                <tr
                  key={table.Name}
                  className="hover:bg-blue-50 cursor-pointer"
                  onDoubleClick={() => onSelectTable(connectionId, database, table.Name)}
                  onContextMenu={(e) => handleContextMenu(e, table.Name)}
                >
                  <td className="border p-2 font-medium whitespace-nowrap">{table.Name}</td>
                  <td className="border p-2 text-right whitespace-nowrap">{table.Rows?.toLocaleString() || 0}</td>
                  <td className="border p-2 text-right whitespace-nowrap">{formatBytes(table.Data_length)}</td>
                  <td className="border p-2 whitespace-nowrap">{table.Engine}</td>
                  <td className="border p-2 whitespace-nowrap">{table.Collation}</td>
                  <td className="border p-2 whitespace-nowrap">{new Date(table.Create_time).toLocaleString()}</td>
                  <td className="border p-2 whitespace-nowrap">{table.Update_time ? new Date(table.Update_time).toLocaleString() : '-'}</td>
                  <td className="border p-2 text-gray-500 whitespace-nowrap">{table.Comment}</td>
                </tr>
              ))}
              {filteredTables.length === 0 && (
                 <tr><td colSpan={8} className="p-4 text-center text-gray-500">{searchKeyword ? 'No matching tables found' : 'No tables found'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white shadow-lg border rounded py-1 z-50 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleOpenTable}
          >
            <Table size={14} /> Open Table
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleDesignTable}
          >
            <Edit size={14} /> Edit Table
          </button>
        </div>
      )}
    </div>
  );
}
