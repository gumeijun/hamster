import React, { useState, useEffect, useRef } from 'react';
import { useConnectionStore } from '../store/useConnectionStore';
import { ConnectionModal } from './ConnectionModal';
import { ConnectionConfig } from '../types';
import { Database, Table, Plus, Server, ChevronRight, ChevronDown, Trash2, Edit, X, Download, Settings, Upload, FileText, Trash } from 'lucide-react';
import { EditDatabaseModal } from './EditDatabaseModal';
import { RenameTableModal } from './RenameTableModal';

interface SidebarProps {
  onSelectTable: (connectionId: string, database: string, table: string, forceRefresh?: boolean) => void;
  onDesignTable: (connectionId: string, database: string, table: string) => void;
  onSelectDatabase: (connectionId: string, database: string) => void;
  onCloseDatabase: (connectionId: string, database: string) => void;
}

export function Sidebar({ onSelectTable, onDesignTable, onSelectDatabase, onCloseDatabase }: SidebarProps) {
  const { savedConnections, addConnection, removeConnection, updateConnection, activeConnectionId, activeConnectionConfigId, setActiveConnection } = useConnectionStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | undefined>(undefined);
  const [isEditDbModalOpen, setIsEditDbModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{database: string, table: string} | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    connectionId: string;
    database: string;
    table: string;
  } | null>(null);

  const [connectionContextMenu, setConnectionContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    configId: string;
  } | null>(null);

  const [dbContextMenu, setDbContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    connectionId: string;
    database: string;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setDbContextMenu(null);
        setConnectionContextMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Expanded states
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set());
  const [openDatabases, setOpenDatabases] = useState<Set<string>>(new Set());
  
  // Data caches
  const [databases, setDatabases] = useState<Record<string, string[]>>({});
  const [tables, setTables] = useState<Record<string, string[]>>({});

  const handleConnectionContextMenu = (e: React.MouseEvent, configId: string) => {
    e.preventDefault();
    setConnectionContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      configId
    });
  };

  const handleEditConnection = () => {
    if (connectionContextMenu) {
        const config = savedConnections.find(c => c.id === connectionContextMenu.configId);
        if (config) {
            setEditingConnection(config);
            setIsModalOpen(true);
        }
        setConnectionContextMenu(null);
    }
  };

  const handleDeleteConnection = () => {
    if (connectionContextMenu) {
        if (window.confirm("Are you sure you want to delete this connection?")) {
            removeConnection(connectionContextMenu.configId);
            // Also close if active?
            if (activeConnectionConfigId === connectionContextMenu.configId) {
                // TODO: Disconnect from backend if needed
                setActiveConnection(null, null);
            }
        }
        setConnectionContextMenu(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, connectionId: string, database: string, table: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      connectionId,
      database,
      table
    });
  };

  const handleDesignTable = () => {
    if (contextMenu) {
      // Use activeConnectionId if the context menu was triggered on the active connection's table
      // But wait, the table item belongs to a config ID. We need the runtime ID.
      // If the table is visible, the connection MUST be active/open (in our current logic).
      // Let's assume activeConnectionId matches contextMenu.connectionId (which is the runtime ID passed down? No, `conn.id` is config ID).
      
      // Wait, `conn.id` is config ID. `activeConnectionId` is runtime ID.
      // The Sidebar passes `activeConnectionId` (runtime) to `onSelectTable`.
      // Let's fix this. `savedConnections.map(conn => ...)` -> conn.id is Config ID.
      
      // When we list tables: `toggleDatabase(conn.id, db)`. 
      // Inside `toggleDatabase`, we use `activeConnectionId`.
      // So when rendering tables, we should use `activeConnectionId` (runtime) IF this connection is active.
      
      // Actually, if we are browsing tables, that connection IS active.
      // So we can just use `activeConnectionId`.
      
      if (activeConnectionId) {
         onDesignTable(activeConnectionId, contextMenu.database, contextMenu.table);
      }
      setContextMenu(null);
    }
  };

  const handleDbContextMenu = (e: React.MouseEvent, connectionId: string, database: string) => {
    e.preventDefault();
    setDbContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      connectionId,
      database
    });
  };

  const handleNewTable = () => {
    if (dbContextMenu) {
       if (!activeConnectionId) {
         alert("Please connect first");
         return;
       }
       onDesignTable(activeConnectionId, dbContextMenu.database, ""); // Empty string for new table
       setDbContextMenu(null);
    }
  };

  const handleCloseDatabase = () => {
    if (dbContextMenu) {
      const key = `${dbContextMenu.connectionId}:${dbContextMenu.database}`;
      const newSet = new Set(expandedDatabases);
      newSet.delete(key);
      setExpandedDatabases(newSet);
      
      const newOpenSet = new Set(openDatabases);
      newOpenSet.delete(key);
      setOpenDatabases(newOpenSet);

      // Notify parent to close tabs
      // We need the RUNTIME connection ID.
      // dbContextMenu.connectionId is CONFIG ID.
      // But App uses Config ID for connection identification in tabs usually?
      // Let's check App.tsx. App.tsx stores `connectionId` in tab data.
      // When `onSelectTable` is called, we pass `activeConnectionId` (runtime ID).
      // So tabs have RUNTIME ID.
      // We need to pass RUNTIME ID to `onCloseDatabase`.
      // BUT `dbContextMenu` only has CONFIG ID (`conn.id`).
      // If we only allow one active connection, we can use `activeConnectionId`.
      // If `activeConnectionConfigId` matches `dbContextMenu.connectionId`, we use `activeConnectionId`.
      
      if (activeConnectionId && activeConnectionConfigId === dbContextMenu.connectionId) {
          onCloseDatabase(activeConnectionId, dbContextMenu.database);
      } else {
          // If we are closing a DB from a non-active connection (is this possible in current UI? Yes if we right click another tree item),
          // we might not have the runtime ID easily if we don't store map.
          // But wait, if it's not active, it's not "connected" in our single-connection model, so no tabs should be open for it.
          // So we only care if it matches active connection.
      }

      setDbContextMenu(null);
    }
  };

  const handleExportDatabase = async (type: 'struct' | 'data_struct') => {
    if (dbContextMenu) {
       if (!activeConnectionId) {
         alert("Please connect first");
         return;
       }
       if (activeConnectionConfigId !== dbContextMenu.connectionId) {
          alert("Please activate this connection first");
          return;
       }

       try {
         const includeData = type === 'data_struct';
         const res = await window.ipcRenderer.invoke('db:export-database', activeConnectionId, dbContextMenu.database, includeData);
         if (res.success) {
           alert("Export Successful!");
         } else if (res.error !== 'Cancelled') {
           alert("Export Failed: " + res.error);
         }
       } catch (err: any) {
         alert("Error: " + err.message);
       }
       setDbContextMenu(null);
    }
  };

  const handleEditDatabase = () => {
    if (dbContextMenu) {
       setIsEditDbModalOpen(true);
       setDbContextMenu(null);
    }
  };

  const handleTruncateTable = async () => {
    if (contextMenu && activeConnectionId) {
       if (!window.confirm(`Are you sure you want to truncate table "${contextMenu.table}"?`)) return;
       try {
         const res = await window.ipcRenderer.invoke('db:truncate-table', activeConnectionId, contextMenu.database, contextMenu.table);
         if (res.success) {
           alert("Table truncated successfully");
           onSelectTable(activeConnectionId, contextMenu.database, contextMenu.table, true); // Refresh view
         } else {
           alert("Failed: " + res.error);
         }
       } catch (err: any) {
         alert("Error: " + err.message);
       }
       setContextMenu(null);
    }
  };

  const handleDeleteTable = async () => {
    if (contextMenu && activeConnectionId) {
       if (!window.confirm(`Are you sure you want to DELETE table "${contextMenu.table}"? This cannot be undone.`)) return;
       try {
         const res = await window.ipcRenderer.invoke('db:drop-table', activeConnectionId, contextMenu.database, contextMenu.table);
         if (res.success) {
           alert("Table deleted successfully");
           // Refresh list
           toggleDatabase(contextMenu.connectionId, contextMenu.database); // This might toggle off, better to force reload
           // For MVP, just toggle off and on or just remove from local state
           setTables(prev => {
             const key = `${contextMenu.connectionId}:${contextMenu.database}`;
             return { ...prev, [key]: prev[key].filter(t => t !== contextMenu.table) };
           });
         } else {
           alert("Failed: " + res.error);
         }
       } catch (err: any) {
         alert("Error: " + err.message);
       }
       setContextMenu(null);
    }
  };

  const handleRenameTable = () => {
    if (contextMenu && activeConnectionId) {
       setRenameTarget({ database: contextMenu.database, table: contextMenu.table });
       setIsRenameModalOpen(true);
       setContextMenu(null);
    }
  };

  const executeRename = async (newName: string) => {
    if (!renameTarget || !activeConnectionId) return;

    try {
      const res = await window.ipcRenderer.invoke('db:rename-table', activeConnectionId, renameTarget.database, renameTarget.table, newName);
      if (res.success) {
        // Update local state
        setTables(prev => {
          if (!activeConnectionConfigId) return prev; 

          const key = `${activeConnectionConfigId}:${renameTarget.database}`;
          const list = prev[key] || [];
          return { ...prev, [key]: list.map(t => t === renameTarget.table ? newName : t) };
        });
      } else {
        alert("Failed: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleDumpTable = async () => {
    if (contextMenu && activeConnectionId) {
       try {
         const res = await window.ipcRenderer.invoke('db:export-table', activeConnectionId, contextMenu.database, contextMenu.table);
         if (res.success) {
           alert("Export Successful!");
         } else if (res.error !== 'Cancelled') {
           alert("Export Failed: " + res.error);
         }
       } catch (err: any) {
         alert("Error: " + err.message);
       }
       setContextMenu(null);
    }
  };

  const handleImportSql = async () => {
    if (dbContextMenu) {
       // We need the runtime connection ID. 
       // dbContextMenu.connectionId is the CONFIG ID.
       // We assume activeConnectionId matches because context menu is only available if we right clicked it.
       // Wait, `handleDbContextMenu` is passed `conn.id` which IS Config ID.
       // But to execute SQL we need Runtime ID.
       // The database is "Open" if `expandedDatabases` has it? No, `expandedConnections` has conn.
       
       // If the user right clicks a database, they might not have it "active" in terms of `activeConnectionId` global state if we allowed multi-connection.
       // But in our current simple logic, we rely on `activeConnectionId`.
       // Let's check if we are connected.
       
       if (!activeConnectionId) {
         alert("Please connect first");
         return;
       }
       
       // Ideally we should verify `activeConnectionConfigId === dbContextMenu.connectionId`.
       if (activeConnectionConfigId !== dbContextMenu.connectionId) {
          // This happens if we right click a DB in a different connection than the active one.
          // For now, let's block or auto-switch? Auto-switch is complex.
          alert("Please activate this connection first (Click on connection name)");
          return;
       }

       try {
         const res = await window.ipcRenderer.invoke('db:import-sql', activeConnectionId, dbContextMenu.database);
         if (res.success) {
           alert("Import Successful!");
           // Refresh tables?
           toggleDatabase(dbContextMenu.connectionId, dbContextMenu.database); // Toggle to refresh?
           // Better: force refresh logic.
         } else if (res.error !== 'Cancelled') {
           alert("Import Failed: " + res.error);
         }
       } catch (err: any) {
         alert("Error: " + err.message);
       }
       setDbContextMenu(null);
    }
  };

  const handleSaveConnection = (config: ConnectionConfig) => {
    if (editingConnection) {
        updateConnection(editingConnection.id, config);
    } else {
        addConnection(config);
    }
    setEditingConnection(undefined);
  };

  const toggleConnection = async (config: ConnectionConfig) => {
    const isExpanded = expandedConnections.has(config.id);
    
    if (isExpanded) {
      const newSet = new Set(expandedConnections);
      newSet.delete(config.id);
      setExpandedConnections(newSet);
      // Optional: Disconnect? No, keep it open for now or explicit disconnect.
      return;
    }

    // Connect if not active or different connection
    // For MVP, we only allow one active connection globally for query editor,
    // but tree view might need multiple? Let's assume single active for simplicity first,
    // OR we manage multiple connections in backend. The backend supports multiple IDs.
    
    // Check if we already have a connection ID for this config
    // For now, let's create a NEW connection every time we expand if not already tracked.
    // But to save resources, let's just use the `activeConnectionId` from store if it matches.
    
    // Actually, each tree item needs its own connection if we want to browse multiple servers.
    // But typically users focus on one. 
    // Let's implement: Click to Connect.
    
    try {
      // Close previous if any (Optional policy)
      if (activeConnectionId && activeConnectionId !== config.id) {
         // await window.ipcRenderer.invoke('db:close', activeConnectionId);
      }

      const res = await window.ipcRenderer.invoke('db:connect', config);
      if (res.success) {
        setActiveConnection(res.id, config.id);
        
        // Fetch databases
        const dbRes = await window.ipcRenderer.invoke('db:list-databases', res.id);
        if (dbRes.success) {
          setDatabases(prev => ({ ...prev, [config.id]: dbRes.results }));
          
          const newSet = new Set(expandedConnections);
          newSet.add(config.id);
          setExpandedConnections(newSet);
        }
      } else {
        alert('Failed to connect: ' + res.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const toggleDatabase = async (connectionId: string, dbName: string) => {
    const key = `${connectionId}:${dbName}`;
    const isExpanded = expandedDatabases.has(key);
    
    if (isExpanded) {
      const newSet = new Set(expandedDatabases);
      newSet.delete(key);
      setExpandedDatabases(newSet);
      return;
    }
    
    // If it's already open (but collapsed), just expand it without re-fetching?
    // Navicat behavior: If open, just toggle expand.
    // If we have data, we can just expand.
    if (openDatabases.has(key) && tables[key]) {
      const newSet = new Set(expandedDatabases);
      newSet.add(key);
      setExpandedDatabases(newSet);
      return;
    }

    // Fetch tables
    // We need the connection ID (the runtime one)
    // We assume the connectionId passed here is the CONFIG id.
    // We need to find the runtime ID.
    // Limitation: If we support multiple open connections, we need to map ConfigID -> RuntimeID.
    // For now, let's use the activeConnectionId.
    
    if (activeConnectionConfigId !== connectionId || !activeConnectionId) {
       alert("Connection lost or changed. Please reconnect.");
       return;
    }

    const res = await window.ipcRenderer.invoke('db:list-tables', activeConnectionId, dbName);
    if (res.success) {
      setTables(prev => ({ ...prev, [key]: res.results }));
      const newSet = new Set(expandedDatabases);
      newSet.add(key);
      setExpandedDatabases(newSet);
      
      const newOpenSet = new Set(openDatabases);
      newOpenSet.add(key);
      setOpenDatabases(newOpenSet);
    } else {
      alert('Failed to list tables: ' + res.error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r">
      <div className="p-2 border-b flex justify-between items-center bg-white">
        <span className="text-sm font-semibold text-gray-600">Connections</span>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-1 hover:bg-gray-100 rounded text-gray-600"
          title="New Connection"
        >
          <Plus size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        {savedConnections.map(conn => (
          <div key={conn.id} className="mb-1">
            <div 
              className={`flex items-center gap-1 p-1 rounded hover:bg-gray-200 cursor-pointer ${activeConnectionConfigId === conn.id ? 'bg-blue-50' : ''}`}
              onClick={() => toggleConnection(conn)}
              onContextMenu={(e) => handleConnectionContextMenu(e, conn.id)}
            >
              {expandedConnections.has(conn.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Server size={14} className="text-gray-500" />
              <span className="text-sm truncate select-none">{conn.name}</span>
            </div>

            {expandedConnections.has(conn.id) && databases[conn.id] && (
              <div className="ml-4 border-l border-gray-300 pl-1 mt-1">
                {databases[conn.id].map(db => {
                  const dbKey = `${conn.id}:${db}`;
                  return (
                    <div key={db}>
                      <div 
                        className="flex items-center gap-1 p-1 rounded hover:bg-gray-200 cursor-pointer"
                        onClick={() => {
                           if (activeConnectionId) {
                              onSelectDatabase(activeConnectionId, db);
                           }
                        }}
                        onDoubleClick={() => toggleDatabase(conn.id, db)}
                        onContextMenu={(e) => handleDbContextMenu(e, conn.id, db)}
                      >
                         <div 
                           onClick={(e) => { e.stopPropagation(); toggleDatabase(conn.id, db); }}
                           className="hover:bg-gray-300 rounded p-0.5"
                         >
                            {expandedDatabases.has(dbKey) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                         </div>
                         <Database size={14} className={openDatabases.has(dbKey) ? "text-green-600" : "text-gray-400"} />
                         <span className={`text-sm truncate select-none ${openDatabases.has(dbKey) ? "text-black" : "text-gray-500"}`}>{db}</span>
                      </div>
                      
                      {expandedDatabases.has(dbKey) && tables[dbKey] && (
                        <div className="ml-4 border-l border-gray-300 pl-1 mt-1">
                           {tables[dbKey].map(table => (
                             <div 
                              key={table} 
                              className="flex items-center gap-1 p-1 rounded hover:bg-gray-200 cursor-pointer pl-4"
                              onClick={() => onSelectTable(activeConnectionId!, db, table)}
                              onContextMenu={(e) => handleContextMenu(e, activeConnectionId!, db, table)}
                            >
                              <Table size={14} className="text-blue-500" />
                              <span className="text-sm truncate select-none">{table}</span>
                            </div>
                          ))}
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
           )}
         </div>
       ))}
     </div>

     <ConnectionModal 
       isOpen={isModalOpen}
       onClose={() => { setIsModalOpen(false); setEditingConnection(undefined); }}
       onSave={handleSaveConnection}
       initialConfig={editingConnection}
     />
     
     {/* Connection Context Menu */}
     {connectionContextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed bg-white shadow-lg border rounded py-1 z-50 min-w-[180px]"
          style={{ top: connectionContextMenu.y, left: connectionContextMenu.x }}
        >
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleEditConnection}
          >
            <Edit size={14} /> Edit Connection
          </button>
          <div className="border-b my-1"></div>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 text-red-600"
            onClick={handleDeleteConnection}
          >
            <Trash2 size={14} /> Delete Connection
          </button>
        </div>
     )}

     {/* Context Menu */}
     {contextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed bg-white shadow-lg border rounded py-1 z-50 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleDesignTable}
          >
            <Edit size={14} /> Design Table
          </button>
          <div className="border-b my-1"></div>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleDumpTable}
          >
            <Download size={14} /> Dump SQL File
          </button>
          <div className="border-b my-1"></div>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleRenameTable}
          >
            <FileText size={14} /> Rename Table
          </button>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleTruncateTable}
          >
            <Trash size={14} /> Truncate Table
          </button>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 text-red-600"
            onClick={handleDeleteTable}
          >
            <Trash2 size={14} /> Delete Table
          </button>
        </div>
      )}

      {/* Database Context Menu */}
      {dbContextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed bg-white shadow-lg border rounded py-1 z-50 min-w-[180px]"
          style={{ top: dbContextMenu.y, left: dbContextMenu.x }}
        >
          <button 
             className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
             onClick={handleCloseDatabase}
           >
             <X size={14} /> Close Database
           </button>
           <div className="border-b my-1"></div>
           
           {/* Only show New Table & Import SQL if database is expanded (considered "Open") */}
           {openDatabases.has(`${dbContextMenu.connectionId}:${dbContextMenu.database}`) && (
              <>
                <button 
                   className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                   onClick={handleNewTable}
                 >
                   <Plus size={14} /> New Table
                 </button>
                 <div className="border-b my-1"></div>
                 <button 
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                  onClick={handleImportSql}
                >
                  <Upload size={14} /> Execute SQL File
                </button>
                <div className="border-b my-1"></div>
              </>
           )}
           
           <button 
             className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
             onClick={() => handleExportDatabase('struct')}
           >
            <Download size={14} /> Export Structure
          </button>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={() => handleExportDatabase('data_struct')}
          >
            <Download size={14} /> Export Structure & Data
          </button>
          <div className="border-b my-1"></div>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleEditDatabase}
          >
            <Settings size={14} /> Edit Database
          </button>
        </div>
      )}

      {dbContextMenu && isEditDbModalOpen && (
        <EditDatabaseModal 
          isOpen={isEditDbModalOpen}
          onClose={() => setIsEditDbModalOpen(false)}
          connectionId={activeConnectionId!} // Assuming active if context menu is up
          database={dbContextMenu.database}
        />
      )}

      {renameTarget && isRenameModalOpen && (
        <RenameTableModal 
          isOpen={isRenameModalOpen}
          onClose={() => setIsRenameModalOpen(false)}
          onRename={executeRename}
          currentName={renameTarget.table}
        />
      )}
    </div>
  );
}
