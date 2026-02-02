/**
 * Main Application Component
 * 
 * The root component that orchestrates the entire application.
 * Features:
 * - Tab management system for multiple open views
 * - Routing between different content types (data viewer, query editor, table designer, etc.)
 * - Context menu for tab operations (close, close others, close all)
 * - Integration with Sidebar for navigation
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { QueryEditor } from './components/QueryEditor'
import { DataViewer } from './components/DataViewer'
import { TableDesigner } from './components/TableDesigner'
import { DatabaseOverview } from './components/DatabaseOverview'
import { ViewsList } from './components/ViewsList'
import { X, Plus, XCircle } from 'lucide-react'

// Sidebar width constraints
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_SIDEBAR_WIDTH = 256;

interface Tab {
  id: string;
  type: 'data' | 'query' | 'design' | 'db_overview' | 'views_list';
  title: string;
  data?: {
    connectionId?: string;
    database?: string;
    table?: string;
    refreshKey?: number;
  };
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Sidebar resizing state
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Tab context menu state
  const [tabContextMenu, setTabContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const tabContextMenuRef = useRef<HTMLDivElement>(null);

  // Handle sidebar resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth
    };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, resizeRef.current.startWidth + delta)
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tabContextMenuRef.current && !tabContextMenuRef.current.contains(e.target as Node)) {
        setTabContextMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const handleSelectTable = (connectionId: string, database: string, table: string, forceRefresh: boolean = false) => {
    // Check if tab already exists
    const existingTab = tabs.find(t => 
      t.type === 'data' && 
      t.data?.connectionId === connectionId && 
      t.data?.database === database && 
      t.data?.table === table
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
      if (forceRefresh) {
         setTabs(prev => prev.map(t => t.id === existingTab.id ? { ...t, data: { ...t.data, refreshKey: Date.now() } } : t));
      }
    } else {
      const newTab: Tab = {
        id: crypto.randomUUID(),
        type: 'data',
        title: table,
        data: { connectionId, database, table }
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleDesignTable = (connectionId: string, database: string, table: string) => {
    const existingTab = tabs.find(t => 
      t.type === 'design' && 
      t.data?.connectionId === connectionId && 
      t.data?.database === database && 
      t.data?.table === table
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: Tab = {
        id: crypto.randomUUID(),
        type: 'design',
        title: table ? `Design: ${table}` : 'New Table',
        data: { connectionId, database, table }
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleSelectDatabase = (connectionId: string, database: string) => {
    const existingTab = tabs.find(t => 
      t.type === 'db_overview' && 
      t.data?.connectionId === connectionId && 
      t.data?.database === database
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: Tab = {
        id: crypto.randomUUID(),
        type: 'db_overview',
        title: database,
        data: { connectionId, database }
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleSelectViews = (connectionId: string, database: string) => {
    const existingTab = tabs.find(t => 
      t.type === 'views_list' && 
      t.data?.connectionId === connectionId && 
      t.data?.database === database
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: Tab = {
        id: crypto.randomUUID(),
        type: 'views_list',
        title: `Views - ${database}`,
        data: { connectionId, database }
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  const handleNewQuery = () => {
    const newTab: Tab = {
      id: crypto.randomUUID(),
      type: 'query',
      title: 'Query',
      // If we have an active tab, use its connection context?
      data: activeTab?.data ? {
         connectionId: activeTab.data.connectionId,
         database: activeTab.data.database
      } : undefined
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    
    if (activeTabId === id) {
       // If closing active tab, switch to last one or null
       if (newTabs.length > 0) {
         setActiveTabId(newTabs[newTabs.length - 1].id);
       } else {
         setActiveTabId(null);
       }
    }
  };

  // Tab context menu handler
  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setTabContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tabId
    });
  };

  // Close all tabs
  const handleCloseAllTabs = () => {
    setTabs([]);
    setActiveTabId(null);
    setTabContextMenu(null);
  };

  // Close other tabs
  const handleCloseOtherTabs = () => {
    if (tabContextMenu) {
      const newTabs = tabs.filter(t => t.id === tabContextMenu.tabId);
      setTabs(newTabs);
      setActiveTabId(tabContextMenu.tabId);
      setTabContextMenu(null);
    }
  };

  // Close current tab (from context menu)
  const handleCloseCurrentTab = () => {
    if (tabContextMenu) {
      handleCloseTab(tabContextMenu.tabId);
      setTabContextMenu(null);
    }
  };

  const handleCloseDesigner = () => {
     // Close current design tab
     if (activeTabId && activeTab?.type === 'design') {
        handleCloseTab(activeTabId, { stopPropagation: () => {} } as any);
     }
  };

  const handleCloseDatabase = (connectionId: string, database: string) => {
     // Close all tabs for this db
     const newTabs = tabs.filter(t => 
        !(t.data?.connectionId === connectionId && t.data?.database === database)
     );
     setTabs(newTabs);
     if (activeTabId && !newTabs.find(t => t.id === activeTabId)) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
     }
  };

  const handleCloseConnection = (connectionId: string) => {
    // Close all tabs for this connection
    const newTabs = tabs.filter(t => t.data?.connectionId !== connectionId);
    setTabs(newTabs);
    if (activeTabId && !newTabs.find(t => t.id === activeTabId)) {
       setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside 
          className="bg-white border-r flex flex-col flex-shrink-0"
          style={{ width: sidebarWidth }}
        >
          <Sidebar
            onSelectTable={handleSelectTable}
            onDesignTable={handleDesignTable}
            onSelectDatabase={handleSelectDatabase}
            onCloseDatabase={handleCloseDatabase}
            onCloseConnection={handleCloseConnection}
            onSelectViews={handleSelectViews}
          />
        </aside>
        
        {/* Resizer */}
        <div
          className={`w-1 bg-transparent hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors ${isResizing ? 'bg-blue-500' : ''}`}
          onMouseDown={handleResizeStart}
        />
        
        <main className="flex-1 flex flex-col bg-gray-50 min-w-0">
          {/* Tabs */}
          <div className="h-10 bg-white border-b flex items-center px-2 gap-1 overflow-x-auto">
             {tabs.map(tab => (
               <div 
                 key={tab.id}
                 className={`group flex items-center gap-2 px-3 py-1 text-sm rounded cursor-pointer min-w-[100px] max-w-[200px] border ${activeTabId === tab.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-transparent hover:bg-gray-100 text-gray-600'}`}
                 onClick={() => setActiveTabId(tab.id)}
                 onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                 title={tab.title}
               >
                 <span className="truncate flex-1">{tab.title}</span>
                 <button 
                   onClick={(e) => handleCloseTab(tab.id, e)}
                   className="p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100"
                 >
                   <X size={12} />
                 </button>
               </div>
             ))}
             
             <button 
               onClick={handleNewQuery}
               className="p-1 hover:bg-gray-100 rounded ml-1 text-gray-500"
               title="New Query"
             >
               <Plus size={16} />
             </button>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            {tabs.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-400">
                Select a table or database from the sidebar
              </div>
            )}

            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              // We use display: none to preserve state
              return (
                <div 
                  key={tab.id} 
                  className="w-full h-full bg-white"
                  style={{ display: isActive ? 'block' : 'none' }}
                >
                  {tab.type === 'data' && tab.data && (
                    <DataViewer 
                      connectionId={tab.data.connectionId!}
                      database={tab.data.database!}
                      table={tab.data.table!}
                      refreshKey={tab.data.refreshKey}
                    />
                  )}
                  {tab.type === 'query' && (
                     <QueryEditor 
                       defaultDatabase={tab.data?.database}
                       connectionId={tab.data?.connectionId} 
                     />
                  )}
                  {tab.type === 'design' && tab.data && (
                     <TableDesigner
                        connectionId={tab.data.connectionId!}
                        database={tab.data.database!}
                        table={tab.data.table!}
                        onClose={handleCloseDesigner}
                     />
                  )}
                  {tab.type === 'db_overview' && tab.data && (
                     <DatabaseOverview
                        connectionId={tab.data.connectionId!}
                        database={tab.data.database!}
                        onSelectTable={handleSelectTable}
                        onDesignTable={handleDesignTable}
                     />
                  )}
                  {tab.type === 'views_list' && tab.data && (
                     <ViewsList
                        connectionId={tab.data.connectionId!}
                        database={tab.data.database!}
                     />
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <div
          ref={tabContextMenuRef}
          className="fixed bg-white shadow-lg border rounded py-1 z-50 min-w-[160px]"
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleCloseCurrentTab}
          >
            <X size={14} /> Close
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
            onClick={handleCloseOtherTabs}
            disabled={tabs.length <= 1}
          >
            <XCircle size={14} /> Close Others
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 text-red-600"
            onClick={handleCloseAllTabs}
          >
            <XCircle size={14} /> Close All
          </button>
        </div>
      )}
    </div>
  )
}

export default App
