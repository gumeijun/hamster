import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, X, Plus, Trash2, Filter } from 'lucide-react';

interface DataViewerProps {
  connectionId: string;
  database: string;
  table: string;
  refreshKey?: number;
}

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
}

const OPERATORS = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '<', value: '<' },
  { label: '<=', value: '<=' },
  { label: '>', value: '>' },
  { label: '>=', value: '>=' },
  { label: 'Contains', value: 'Contains' },
  { label: 'Not Contains', value: 'Not Contains' },
  { label: 'Starts With', value: 'Starts With' },
  { label: 'Not Starts With', value: 'Not Starts With' },
  { label: 'Ends With', value: 'Ends With' },
  { label: 'Not Ends With', value: 'Not Ends With' },
  { label: 'Is NULL', value: 'IS NULL' },
  { label: 'Is Not NULL', value: 'IS NOT NULL' },
  { label: 'Is Empty', value: 'Is Empty' },
  { label: 'Is Not Empty', value: 'Is Not Empty' },
  { label: 'Between', value: 'Between' },
  { label: 'Not Between', value: 'Not Between' },
  { label: 'In List', value: 'IN' },
  { label: 'Not In List', value: 'NOT IN' }
];

export function DataViewer({ connectionId, database, table, refreshKey }: DataViewerProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter State
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  
  // Edit Modal State
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [originalRow, setOriginalRow] = useState<any | null>(null); // To detect changes
  const [columns, setColumns] = useState<any[]>([]); // To know types and PK
  
  const LIMIT = 50;

  const [selectedKeys, setSelectedKeys] = useState<Set<any>>(new Set());
  const [isAddMode, setIsAddMode] = useState(false);

  const formatDisplayValue = (val: any, type: string = '') => {
    if (val === null) return null;
    const typeLower = type.toLowerCase();
    if (typeLower.includes('datetime') || typeLower.includes('timestamp')) {
       const d = new Date(val);
       if (!isNaN(d.getTime())) {
          return d.toLocaleString('zh-CN', {
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
    }
    return String(val);
  };

  useEffect(() => {
    // Reset filters when table changes
    setFilters([]);
    setIsFilterVisible(false);
    fetchData(); // This will use empty filters
    fetchColumns();
    setSelectedKeys(new Set()); 
  }, [connectionId, database, table]);

  useEffect(() => {
    if (refreshKey) {
        fetchData();
    }
  }, [refreshKey]);

  // Fetch data when page changes
  useEffect(() => {
    fetchData();
    setSelectedKeys(new Set());
  }, [page]);

  const fetchColumns = async () => {
    try {
      const res = await window.ipcRenderer.invoke('db:get-table-structure', connectionId, database, table);
      if (res.success) {
        setColumns(res.results);
      }
    } catch (err) {
      console.error("Failed to fetch columns for editing", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * LIMIT;
      // Filter out disabled filters and prepare payload
      const activeFilters = filters.filter(f => f.enabled).map(f => ({
         column: f.column,
         operator: f.operator,
         value: f.value
      }));
      
      const res = await window.ipcRenderer.invoke('db:get-table-data', connectionId, database, table, LIMIT, offset, activeFilters);
      if (res.success) {
        setData(res.results);
        setTotalPages(Math.ceil(res.total / LIMIT) || 1);
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter Handlers
  const handleAddFilter = () => {
     if (columns.length === 0) return;
     setFilters([...filters, {
        id: crypto.randomUUID(),
        column: columns[0].Field,
        operator: '=',
        value: '',
        enabled: true
     }]);
  };

  const handleRemoveFilter = (id: string) => {
     setFilters(filters.filter(f => f.id !== id));
  };

  const handleUpdateFilter = (id: string, field: keyof FilterCondition, value: any) => {
     setFilters(filters.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleApplyFilter = () => {
     setPage(1); // Reset to first page
     fetchData();
  };

  const handleRowDoubleClick = (row: any) => {
    const formattedRow = { ...row };
    columns.forEach(col => {
       const key = col.Field;
       // We format values for the edit form, especially dates
       if (formattedRow[key] !== null) {
          // Note: This converts everything to string effectively, which is fine for inputs
          formattedRow[key] = formatDisplayValue(row[key], col.Type);
       }
    });
    setEditingRow(formattedRow); 
    setOriginalRow(formattedRow);
    setIsAddMode(false);
  };

  const handleAddRecord = () => {
    // Create empty row based on columns
    const newRow: any = {};
    columns.forEach(col => {
      // Set default values if possible? For now null/undefined
      newRow[col.Field] = null; 
    });
    setEditingRow(newRow);
    setOriginalRow(null);
    setIsAddMode(true);
  };

  const handleToggleSelect = (pkValue: any) => {
    const newSet = new Set(selectedKeys);
    if (newSet.has(pkValue)) {
      newSet.delete(pkValue);
    } else {
      newSet.add(pkValue);
    }
    setSelectedKeys(newSet);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pkCol = columns.find((c: any) => c.Key === 'PRI');
      if (pkCol) {
        const newSet = new Set(data.map(row => row[pkCol.Field]));
        setSelectedKeys(newSet);
      }
    } else {
      setSelectedKeys(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedKeys.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedKeys.size} records?`)) return;

    const pkCol = columns.find((c: any) => c.Key === 'PRI');
    if (!pkCol) {
      alert("Cannot delete: No Primary Key found.");
      return;
    }

    try {
      const res = await window.ipcRenderer.invoke('db:delete-rows', connectionId, database, table, pkCol.Field, Array.from(selectedKeys));
      if (res.success) {
        fetchData();
        setSelectedKeys(new Set());
      } else {
        alert("Failed to delete: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;

    if (isAddMode) {
      try {
         // Filter out nulls if column allows null? Or send explicit NULL?
         // Backend handles basic values.
         // We should only send fields that are filled or explicitly set?
         // For now send everything in editingRow.
         const res = await window.ipcRenderer.invoke('db:insert-row', connectionId, database, table, editingRow);
         if (res.success) {
           fetchData();
           setEditingRow(null);
         } else {
           alert("Insert failed: " + res.error);
         }
      } catch (err: any) {
         alert("Error: " + err.message);
      }
      return;
    }

    if (!originalRow) return;

    // Identify Primary Key
    const pkCol = columns.find((c: any) => c.Key === 'PRI');
    if (!pkCol) {
      alert("Cannot edit row: Table has no Primary Key.");
      return;
    }
    
    const pkName = pkCol.Field;
    const pkValue = originalRow[pkName];

    // Calculate diff
    const updates: Record<string, any> = {};
    let hasChanges = false;
    
    Object.keys(editingRow).forEach(key => {
       if (editingRow[key] !== originalRow[key]) {
         updates[key] = editingRow[key];
         hasChanges = true;
       }
    });

    if (!hasChanges) {
      setEditingRow(null);
      return;
    }

    try {
       const res = await window.ipcRenderer.invoke('db:update-row', connectionId, database, table, { col: pkName, val: pkValue }, updates);
       if (res.success) {
         // Refresh data
         fetchData();
         setEditingRow(null);
       } else {
         alert("Update failed: " + res.error);
       }
    } catch (err: any) {
       alert("Error: " + err.message);
    }
  };

  const handleInputChange = (field: string, value: string) => {
     setEditingRow((prev: any) => ({ ...prev, [field]: value }));
  };

  if (loading && !data.length) return <div className="p-4 text-gray-500">Loading data...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  const pkCol = columns.find((c: any) => c.Key === 'PRI');

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b bg-gray-50">
        <div className="h-10 flex items-center px-2 justify-between">
           <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700 text-sm ml-2">{table}</span>
              <div className="h-4 border-l mx-2"></div>
              <button 
                onClick={handleAddRecord}
                className="p-1 px-2 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1"
              >
                <Plus size={14} /> Add Record
              </button>
              <button 
                onClick={handleDeleteSelected}
                disabled={selectedKeys.size === 0}
                className="p-1 px-2 bg-red-600 text-white rounded text-xs hover:bg-red-700 flex items-center gap-1 disabled:opacity-50 disabled:bg-gray-400"
              >
                <Trash2 size={14} /> Delete Selected ({selectedKeys.size})
              </button>
              <div className="h-4 border-l mx-2"></div>
              <button
                onClick={() => setIsFilterVisible(!isFilterVisible)}
                className={`p-1 px-2 rounded text-xs flex items-center gap-1 border ${isFilterVisible || filters.length > 0 ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white hover:bg-gray-100 text-gray-700'}`}
              >
                 <Filter size={14} /> Filter {filters.filter(f => f.enabled).length > 0 && `(${filters.filter(f => f.enabled).length})`}
              </button>
           </div>
           <div className="flex items-center gap-2">
             <button 
               disabled={page === 1}
               onClick={() => setPage(p => p - 1)}
               className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
             >
               <ChevronLeft size={16} />
             </button>
             <span className="text-sm">Page {page} of {totalPages}</span>
             <button 
               disabled={page === totalPages}
               onClick={() => setPage(p => p + 1)}
               className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
             >
               <ChevronRight size={16} />
             </button>
             <button 
               onClick={() => fetchData()}
               className="ml-2 p-1 hover:bg-gray-200 rounded text-xs px-2 border"
             >
               Refresh
             </button>
           </div>
        </div>

        {/* Filter Panel */}
        {isFilterVisible && (
           <div className="p-2 border-t bg-gray-50 flex flex-col gap-2">
              <div className="flex flex-col gap-2 max-h-[200px] overflow-auto">
                 {filters.length === 0 && <div className="text-xs text-gray-500 italic p-1">No active filters. Click 'Add Condition' to start.</div>}
                 {filters.map((filter, i) => (
                    <div key={filter.id} className="flex items-center gap-2 text-sm">
                       <input 
                         type="checkbox" 
                         checked={filter.enabled} 
                         onChange={(e) => handleUpdateFilter(filter.id, 'enabled', e.target.checked)}
                       />
                       <select 
                         className="border rounded p-1 max-w-[150px]"
                         value={filter.column}
                         onChange={(e) => handleUpdateFilter(filter.id, 'column', e.target.value)}
                       >
                          {columns.map(c => <option key={c.Field} value={c.Field}>{c.Field}</option>)}
                       </select>
                       <select 
                         className="border rounded p-1 w-[120px]"
                         value={filter.operator}
                         onChange={(e) => handleUpdateFilter(filter.id, 'operator', e.target.value)}
                       >
                          {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                       </select>
                       
                       {!['IS NULL', 'IS NOT NULL', 'Is Empty', 'Is Not Empty'].includes(filter.operator) && (
                          <input 
                            className="border rounded p-1 flex-1 min-w-[100px]"
                            value={filter.value}
                            onChange={(e) => handleUpdateFilter(filter.id, 'value', e.target.value)}
                            placeholder={filter.operator.includes('Between') ? "val1, val2" : "Value"}
                          />
                       )}
                       
                       <button onClick={() => handleRemoveFilter(filter.id)} className="text-gray-400 hover:text-red-500">
                          <X size={14} />
                       </button>
                    </div>
                 ))}
              </div>
              <div className="flex gap-2 mt-1">
                 <button onClick={handleAddFilter} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800">
                    <Plus size={12} /> Add Condition
                 </button>
                 <div className="flex-1"></div>
                 <button onClick={handleApplyFilter} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                    Apply Filter
                 </button>
              </div>
           </div>
        )}
      </div>

      <div className="flex-1 overflow-auto w-full">
        {/* ... existing loading/error/empty checks ... */}
        {loading && <div className="text-gray-500 p-4 absolute top-10 right-0 bg-white shadow rounded z-20">Loading...</div>}
        
        {!loading && !error && data.length === 0 && (
          <div className="text-gray-500 p-4">Table is empty or no data for this page.</div>
        )}

        {data.length > 0 && (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
                <tr>
                  <th className="border border-gray-300 px-2 py-1 w-8 bg-gray-100 text-center">
                    {pkCol && (
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={data.length > 0 && selectedKeys.size === data.length}
                      />
                    )}
                  </th>
                  {Object.keys(data[0]).map(key => {
                     const col = columns.find(c => c.Field === key);
                     return (
                        <th key={key} className="border border-gray-300 px-2 py-1 text-left font-medium whitespace-nowrap bg-gray-100 max-w-[200px] overflow-hidden text-ellipsis" title={key}>
                           <div>{key}</div>
                           <div className="flex gap-2 text-xs text-gray-400 font-normal font-mono">
                              <span>{col ? col.Type : ''}</span>
                              {col?.Comment && <span className="text-gray-500 italic" title={col.Comment}>({col.Comment})</span>}
                           </div>
                        </th>
                     );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const pkValue = pkCol ? row[pkCol.Field] : null;
                  return (
                    <tr 
                      key={i} 
                      className={`hover:bg-blue-50 cursor-pointer ${selectedKeys.has(pkValue) ? 'bg-blue-100' : ''}`}
                      onDoubleClick={() => handleRowDoubleClick(row)}
                    >
                      <td className="border border-gray-300 px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                         {pkCol && (
                           <input 
                             type="checkbox"
                             checked={selectedKeys.has(pkValue)}
                             onChange={() => handleToggleSelect(pkValue)}
                           />
                         )}
                      </td>
                      {Object.keys(data[0]).map((key, j) => {
                        const val = row[key];
                        const col = columns.find(c => c.Field === key);
                        const displayVal = formatDisplayValue(val, col?.Type);
                        return (
                          <td key={j} className="border border-gray-300 px-2 py-1 whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis" title={val === null ? 'NULL' : String(displayVal)}>
                            {val === null ? <span className="text-gray-400 italic">NULL</span> : displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">{isAddMode ? 'Add Record' : 'Edit Row'}</h3>
              <button onClick={() => setEditingRow(null)} className="hover:bg-gray-100 p-1 rounded">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4 grid gap-4">
               {columns.map(col => {
                 const key = col.Field;
                 // In Add Mode, iterate columns. In Edit Mode, we iterate editingRow usually, but columns is safer order.
                 // editingRow should have all keys if initialized correctly.
                 
                 const isPk = col.Key === 'PRI';
                 const isBlob = col.Type.includes('blob');
                 const val = editingRow[key];
                 
                 const typeLower = col.Type.toLowerCase();
                 const isDateTime = typeLower.includes('datetime') || typeLower.includes('timestamp');
                 const isDate = typeLower === 'date';
                 const isNumeric = ['int', 'tinyint', 'smallint', 'mediumint', 'bigint', 'float', 'double', 'decimal'].some(t => typeLower.includes(t));
                 
                 let inputType = 'text';
                 let displayVal = val === null ? '' : val;
                 let validationError = '';

                 if (isDateTime) {
                    inputType = 'datetime-local';
                    // Ensure 'T' separator for input value if it has space (from formatDisplayValue)
                    if (typeof displayVal === 'string' && displayVal.includes(' ')) {
                        displayVal = displayVal.replace(' ', 'T');
                    }
                 } else if (isDate) {
                    inputType = 'date';
                 }

                 if (isNumeric && displayVal !== '' && isNaN(Number(displayVal))) {
                    validationError = 'Invalid number format';
                 }
                 
                 return (
                   <div key={key} className="flex flex-col">
                     <label className="text-xs font-medium text-gray-500 mb-1">
                       {key} {isPk && <span className="text-yellow-600">(PK)</span>}
                     </label>
                     {isBlob ? (
                        <textarea 
                          className="border rounded p-2 text-sm bg-gray-50 text-gray-500"
                          value="[BLOB Data]"
                          disabled
                        />
                     ) : (
                       <>
                         <input 
                           type={inputType} 
                           className={`border rounded p-2 text-sm ${validationError ? 'border-red-500 bg-red-50' : ''}`}
                           value={displayVal}
                           onChange={(e) => handleInputChange(key, e.target.value)}
                           placeholder={val === null ? 'NULL' : ''}
                           // Enable PK editing if Add Mode, else typically disable or be careful
                           disabled={!isAddMode && isPk}
                           step={isDateTime ? "1" : undefined}
                         />
                         {validationError && <span className="text-xs text-red-500 mt-1">{validationError}</span>}
                       </>
                     )}
                   </div>
                 );
               })}
            </div>

            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
               <button 
                 onClick={() => setEditingRow(null)}
                 className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleSaveEdit}
                 className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded text-sm flex items-center gap-1"
               >
                 <Save size={14} /> Save {isAddMode ? 'Record' : 'Changes'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
