import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { QueryEditor } from './components/QueryEditor'
import { DataViewer } from './components/DataViewer'
import { TableDesigner } from './components/TableDesigner'
import { DatabaseOverview } from './components/DatabaseOverview'
import { X, Plus } from 'lucide-react'

interface Tab {
  id: string;
  type: 'data' | 'query' | 'design' | 'db_overview';
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

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-white border-r flex flex-col">
          <Sidebar 
            onSelectTable={handleSelectTable} 
            onDesignTable={handleDesignTable} 
            onSelectDatabase={handleSelectDatabase}
            onCloseDatabase={handleCloseDatabase}
          />
        </aside>
        <main className="flex-1 flex flex-col bg-gray-50 min-w-0">
          {/* Tabs */}
          <div className="h-10 bg-white border-b flex items-center px-2 gap-1 overflow-x-auto">
             {tabs.map(tab => (
               <div 
                 key={tab.id}
                 className={`group flex items-center gap-2 px-3 py-1 text-sm rounded cursor-pointer min-w-[100px] max-w-[200px] border ${activeTabId === tab.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-transparent hover:bg-gray-100 text-gray-600'}`}
                 onClick={() => setActiveTabId(tab.id)}
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
                     />
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
