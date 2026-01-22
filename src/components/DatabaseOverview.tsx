import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface DatabaseOverviewProps {
  connectionId: string;
  database: string;
  onSelectTable: (connectionId: string, database: string, table: string) => void;
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

export function DatabaseOverview({ connectionId, database, onSelectTable }: DatabaseOverviewProps) {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <h2 className="font-semibold text-gray-700">Database: {database}</h2>
        <button onClick={fetchData} className="p-1 hover:bg-gray-200 rounded text-gray-600" title="Refresh">
          <RefreshCw size={14} />
        </button>
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
              {tables.map((table) => (
                <tr 
                  key={table.Name} 
                  className="hover:bg-blue-50 cursor-pointer"
                  onDoubleClick={() => onSelectTable(connectionId, database, table.Name)}
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
              {tables.length === 0 && (
                 <tr><td colSpan={8} className="p-4 text-center text-gray-500">No tables found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
