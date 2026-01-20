import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play } from 'lucide-react';
import { useConnectionStore } from '../store/useConnectionStore';

export function QueryEditor({ defaultDatabase, connectionId }: { defaultDatabase?: string, connectionId?: string }) {
  const { activeConnectionId: storeConnectionId } = useConnectionStore();
  const activeConnectionId = connectionId || storeConnectionId;
  const [sql, setSql] = useState('SELECT * FROM users LIMIT 10;');
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!activeConnectionId) {
      setError('No active connection');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      // Pass empty params array and the defaultDatabase
      const res = await window.ipcRenderer.invoke('db:query', activeConnectionId, sql, [], defaultDatabase);
      if (res.success) {
        if (Array.isArray(res.results)) {
           setResults(res.results);
        } else {
           // Handle non-select results (OkPacket)
           setResults([{ message: 'Query executed successfully', ...res.results }]);
        }
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayValue = (val: any) => {
    if (val === null) return <span className="text-gray-400">NULL</span>;
    
    if (val instanceof Date) {
       return val.toLocaleString('zh-CN', {
         timeZone: 'Asia/Shanghai',
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         hour12: false
       }).replace(/\//g, '-');
    }
    
    return String(val);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 border-b bg-white flex items-center px-2">
        <button 
          onClick={handleRun}
          disabled={loading || !activeConnectionId}
          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          <Play size={14} /> Run
        </button>
      </div>
      
      <div className="h-1/2 border-b">
        <Editor 
          height="100%" 
          defaultLanguage="sql" 
          value={sql}
          onChange={(value) => setSql(value || '')}
          options={{ minimap: { enabled: false } }}
        />
      </div>
      
      <div className="flex-1 overflow-auto bg-white p-2">
        {error && <div className="text-red-500 p-2">{error}</div>}
        {loading && <div className="text-gray-500 p-2">Executing...</div>}
        
        {results && results.length > 0 && (
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                {Object.keys(results[0]).map(key => (
                  <th key={key} className="border border-gray-300 px-2 py-1 text-left font-medium">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {Object.values(row).map((val: any, j) => (
                    <td key={j} className="border border-gray-300 px-2 py-1 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                      {formatDisplayValue(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {results && results.length === 0 && (
           <div className="text-gray-500 p-2">No results found.</div>
        )}
      </div>
    </div>
  );
}
